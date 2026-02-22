import { createPortal } from 'react-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface ParasutCodeModalProps {
  open: boolean;
  authUrl: string;
  authorizationCode: string;
  isExchangingCode: boolean;
  onAuthorizationCodeChange: (value: string) => void;
  onOpenAuthPage: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ParasutCodeModal({
  open,
  authUrl,
  authorizationCode,
  isExchangingCode,
  onAuthorizationCodeChange,
  onOpenAuthPage,
  onCancel,
  onConfirm,
}: ParasutCodeModalProps) {
  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
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
          padding: '24px',
        }}
      >
        <div className="mb-2 text-lg font-semibold">Paraşüt Yetkilendirme Kodu</div>
        <p className="text-sm text-muted-foreground mb-4">
          Paraşüt girişini onayladıktan sonra gelen code değerini veya tam URL&apos;yi buraya
          yapıştırın.
        </p>

        <div className="space-y-3">
          <Button type="button" variant="outline" className="w-full" onClick={onOpenAuthPage}>
            {authUrl ? 'Paraşüt Giriş Sayfasını Aç' : 'Code Değerini Manuel Gir'}
          </Button>
          <Input
            value={authorizationCode}
            onChange={(event) => onAuthorizationCodeChange(event.target.value)}
            placeholder="code veya https://api.parasut.com/.../native?code=..."
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isExchangingCode}>
            İptal
          </Button>
          <Button type="button" onClick={onConfirm} disabled={isExchangingCode}>
            {isExchangingCode ? 'Bağlanıyor...' : 'Kodu Doğrula ve Senkronize Et'}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
