import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link2, RefreshCw, Save, Eye, EyeOff, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';

// Add ImportMetaEnv declaration for Vite environment variables
declare global {
  interface ImportMetaEnv {
    VITE_API_BASE_URL?: string;
    VITE_PARASUT_COMPANY_ID?: string;
    // add other env variables as needed
  }
  interface ImportMeta {
    env: ImportMetaEnv;
  }
}

type DraftProduct = {
  _id: string;
  parasutId: string;
  name: string;
  code?: string;
  barcode?: string;
  archived?: boolean;
  unit?: string;
  currency?: string;
  mapped?: boolean;
};

type MappingRow = {
  id: string;
  name: string;
  code: string;
  barcode: string;
  archived: boolean;
  unit: string;
  currency: string;
  mapped: boolean;
  selected: boolean;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
const PARASUT_COMPANY_ID = import.meta.env.VITE_PARASUT_COMPANY_ID || '';

export function ParasutProductMappingView() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [mappings, setMappings] = useState<any[]>([]);
  const [showDraftPool, setShowDraftPool] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMappedProducts, setShowMappedProducts] = useState(false);
  const [page, setPage] = useState(1);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const pageSize = 50;

  const selectedCount = useMemo(() => rows.filter((row) => row.selected).length, [rows]);
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('tr-TR');
    return rows.filter((row) => {
      const matchMapping = showMappedProducts ? row.mapped : !row.mapped;
      if (!matchMapping) return false;
      if (!q) return true;
      return (
        row.name.toLocaleLowerCase('tr-TR').includes(q) ||
        row.code.toLocaleLowerCase('tr-TR').includes(q) ||
        row.id.toLocaleLowerCase('tr-TR').includes(q)
      );
    });
  }, [rows, searchQuery, showMappedProducts]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageRows = useMemo(() => {
    const safePage = Math.min(page, pageCount);
    const start = (safePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageCount]);

  const selectedOnPageCount = useMemo(
    () => pageRows.filter((row) => row.selected).length,
    [pageRows],
  );

  const fetchMappings = async () => {
    const response = await fetch(`${API_BASE_URL}/api/parasut/mappings`);
    if (!response.ok) return;
    const payload = await response.json().catch(() => ({ data: [] }));
    setMappings(Array.isArray(payload.data) ? payload.data : []);
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        include: 'category',
      });
      if (PARASUT_COMPANY_ID) {
        params.set('company_id', PARASUT_COMPANY_ID);
      }

      const response = await fetch(`${API_BASE_URL}/api/parasut/drafts?${params.toString()}`);
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.message || 'Taslak ürünler alınamadı');
      }

      const payload = await response.json();
      const data = Array.isArray(payload?.data) ? (payload.data as DraftProduct[]) : [];

      const mappedRows: MappingRow[] = data.map((item) => {
        const name = String(item.name || '').trim();
        return {
          id: String(item.parasutId),
          name,
          code: String(item.code || '').trim(),
          barcode: String(item.barcode || '').trim(),
          archived: Boolean(item.archived),
          unit: String(item.unit || '').trim(),
          currency: String(item.currency || '').trim(),
          mapped: Boolean(item.mapped),
          selected: false,
        };
      });

      setRows(mappedRows);
      setPage(1);
      toast.success(`${mappedRows.length} taslak ürün yüklendi`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata oluştu';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchMappings();
  }, []);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const toggleAllOnPage = (value: boolean) => {
    const visibleIds = new Set(pageRows.map((row) => row.id));
    setRows((prev) =>
      prev.map((row) => (visibleIds.has(row.id) ? { ...row, selected: value } : row)),
    );
  };

  const updateRow = (id: string, patch: Partial<MappingRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const openGroupModal = () => {
    const selectedRows = rows.filter((row) => row.selected);
    if (selectedRows.length === 0) {
      toast.error('En az bir ürün seçin');
      return;
    }

    setGroupNameInput('');
    setIsGroupModalOpen(true);
  };

  const saveSelectedMappings = async () => {
    const selectedRows = rows.filter((row) => row.selected);
    if (selectedRows.length === 0) {
      toast.error('En az bir ürün seçin');
      return;
    }

    const canonicalName = groupNameInput.trim();
    if (!canonicalName) {
      toast.error('Grup adı zorunlu');
      return;
    }

    const groups = [
      {
        canonicalName,
        items: selectedRows.map((item) => ({
          parasutId: item.id,
          name: item.name || `Ürün-${item.id}`,
          code: item.code,
          barcode: item.barcode,
          archived: item.archived,
          unit: item.unit,
          currency: item.currency,
        })),
      },
    ];

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/parasut/mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.message || 'Mapping kaydedilemedi');
      }

      toast.success(`Kaydedildi: ${groups.length} ürün grubu`);
      setIsGroupModalOpen(false);
      setGroupNameInput('');
      await fetchMappings();
      await fetchProducts();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata oluştu';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const selectedRowsPreview = useMemo(
    () => rows.filter((row) => row.selected).slice(0, 5),
    [rows],
  );

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link2 className="w-6 h-6 text-primary" />
            <h1>Paraşüt Ürün Eşleştirme</h1>
          </div>
          <p className="text-muted-foreground">Taslak ürünleri gruplandırarak LOT kaydı tutulacak nihai ürünlere dönüştürebilirsiniz.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchProducts} disabled={loading || saving}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Yenile
          </Button>
          <Button onClick={openGroupModal} disabled={saving || loading}>
            <Save className="w-4 h-4 mr-2" />
            Seçilenleri Grupla
          </Button>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Taslak ürün: {rows.length} | Filtrelenen: {filteredRows.length} | Seçilen: {selectedCount}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showMappedProducts ? 'default' : 'outline'}
            onClick={() => setShowMappedProducts((v) => !v)}
            className="gap-2"
          >
            {showMappedProducts ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
            Eşleştirilmiş Ürünler: {showMappedProducts ? 'Açık' : 'Kapalı'}
          </Button>
          <Button
            variant={showDraftPool ? 'default' : 'outline'}
            onClick={() => setShowDraftPool((v) => !v)}
            className="gap-2"
          >
            {showDraftPool ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            Taslak Havuzu: {showDraftPool ? 'Açık' : 'Kapalı'}
          </Button>
        </div>
      </div>

      {showDraftPool && (
      <div className="rounded-lg border border-border overflow-hidden mb-8">
        <div className="p-3 border-b border-border bg-muted/30">
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Ürün adına/koda göre ara..."
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[80px]">
                <input
                  type="checkbox"
                  checked={pageRows.length > 0 && selectedOnPageCount === pageRows.length}
                  onChange={(e) => toggleAllOnPage(e.target.checked)}
                />
              </TableHead>
              <TableHead>Paraşüt ID</TableHead>
              <TableHead>Kod</TableHead>
              <TableHead>Ürün Adı</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={row.selected}
                    onChange={(e) => updateRow(row.id, { selected: e.target.checked })}
                  />
                </TableCell>
                <TableCell>
                  <code className="text-xs">{row.id}</code>
                </TableCell>
                <TableCell>
                  <code className="text-xs">{row.code || '-'}</code>
                </TableCell>
                <TableCell>{row.name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t border-border p-3">
          <div className="text-xs text-muted-foreground">
            Sayfa {page} / {pageCount} | Bu sayfa: {pageRows.length} kayıt
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Önceki
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Sonraki
            </Button>
          </div>
        </div>
      </div>
      )}

      <div className="rounded-lg border border-border p-4">
        <h3 className="mb-3">Eşleşen Nihai Ürünler (products)</h3>
        <div className="space-y-2">
          {mappings.length === 0 && (
            <div className="text-sm text-muted-foreground">Henüz mapping kaydı yok.</div>
          )}
          {mappings.map((mapping) => (
            <div
              key={mapping._id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded border border-border px-3 py-2"
            >
              <div className="font-medium break-words">{mapping.canonicalName}</div>
              <div className="text-sm text-muted-foreground sm:shrink-0">
                {Array.isArray(mapping.parasutProductIds) ? mapping.parasutProductIds.length : 0} kayıt
              </div>
            </div>
          ))}
        </div>
      </div>

      {typeof document !== 'undefined' &&
        isGroupModalOpen &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 2147483647,
              background: 'rgba(0, 0, 0, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '560px',
                background: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.35)',
                padding: '20px',
              }}
            >
              <div className="text-lg font-semibold mb-1">Seçilenleri Grupla</div>
              <p className="text-sm text-muted-foreground mb-3">
                Seçtiğiniz ürünleri tek bir nihai ürün altında birleştirmek için Grup Adı girin.
              </p>
              <Input
                value={groupNameInput}
                onChange={(e) => setGroupNameInput(e.target.value)}
                placeholder="örn: aktif-karbon-kati-sampuan"
                autoFocus
              />
              {selectedRowsPreview.length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Örnek seçili ürünler: {selectedRowsPreview.map((r) => r.name).join(', ')}
                  {selectedCount > selectedRowsPreview.length &&
                    ` +${selectedCount - selectedRowsPreview.length}`}
                </div>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsGroupModalOpen(false)}
                  disabled={saving}
                >
                  İptal
                </Button>
                <Button onClick={saveSelectedMappings} disabled={saving}>
                  {saving ? 'Kaydediliyor...' : 'Grupla ve Kaydet'}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
