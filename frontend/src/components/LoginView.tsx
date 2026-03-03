import { useState } from 'react';
import { Package, Mail, Lock, ArrowRight } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { toast } from 'sonner';

interface LoginViewProps {
  onLogin: (token: string) => void;
}

export function LoginView({ onLogin }: LoginViewProps) {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      toast.error('Lütfen geçerli bir e-posta adresi girin');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/request-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Kod gönderilemedi');
      }

      setStep('code');
      toast.success('Doğrulama kodu e-postanıza gönderildi!', {
        description: 'Lütfen 6 haneli kodu girin',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kod gönderilemedi';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value[0];
    }

    if (!/^\d*$/.test(value)) {
      return;
    }

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      nextInput?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (newCode.every((digit) => digit !== '') && index === 5) {
      handleCodeSubmit(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const prevInput = document.getElementById(`code-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const digits = pasted.replace(/\D/g, '').slice(0, 6);
    if (!digits) return;

    const nextCode = ['', '', '', '', '', ''];
    digits.split('').forEach((digit, index) => {
      nextCode[index] = digit;
    });
    setCode(nextCode);

    if (digits.length === 6) {
      handleCodeSubmit(digits);
      return;
    }

    const nextInput = document.getElementById(`code-${digits.length}`);
    nextInput?.focus();
  };

  const handleCodeSubmit = async (fullCode?: string) => {
    const codeToVerify = fullCode || code.join('');
    
    if (codeToVerify.length !== 6) {
      toast.error('Lütfen 6 haneli doğrulama kodunu girin');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: codeToVerify,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Kod doğrulanamadı');
      }

      const token = String(payload?.token || '');
      if (!token) {
        throw new Error('Token alınamadı');
      }

      toast.success('Giriş başarılı!');
      onLogin(token);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kod doğrulanamadı';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setCode(['', '', '', '', '', '']);
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/request-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Kod tekrar gönderilemedi');
      }
      toast.success('Yeni doğrulama kodu gönderildi!');
      const firstInput = document.getElementById('code-0');
      firstInput?.focus();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kod tekrar gönderilemedi';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
    setCode(['', '', '', '', '', '']);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4">
            <Package className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="mb-2">LOT Tracking</h1>
          <p className="text-muted-foreground">
            KRIJEN
          </p>
        </div>

        {/* Login Card */}
        <Card className="shadow-lg">
          {step === 'email' ? (
            <>
              <CardHeader>
                <CardTitle>Giriş Yap</CardTitle>
                <CardDescription>
                  E-posta adresinize gönderilecek doğrulama kodu ile giriş yapın
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="email">E-posta Adresi</Label>
                    <div className="relative mt-2">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="ornek@sirket.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        autoFocus
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full gap-2"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      'Gönderiliyor...'
                    ) : (
                      <>
                        Doğrulama Kodu Gönder
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Doğrulama Kodu</CardTitle>
                <CardDescription>
                  <strong>{email}</strong> adresine gönderilen 6 haneli kodu girin
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Code Input */}
                  <div>
                    <Label className="mb-3 block text-center">
                      6 Haneli Doğrulama Kodu
                    </Label>
                    <div className="flex gap-2 justify-center">
                      {code.map((digit, index) => (
                        <Input
                          key={index}
                          id={`code-${index}`}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleCodeChange(index, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(index, e)}
                          onPaste={handleCodePaste}
                          className="w-12 h-12 text-center text-lg border-2 border-border bg-background focus-visible:border-primary"
                        />
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={() => handleCodeSubmit()}
                    className="w-full gap-2"
                    disabled={isLoading || code.some((d) => !d)}
                  >
                    {isLoading ? (
                      'Doğrulanıyor...'
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        Giriş Yap
                      </>
                    )}
                  </Button>

                  {/* Actions */}
                  <div className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={handleBackToEmail}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      ← E-posta değiştir
                    </button>
                    <button
                      type="button"
                      onClick={handleResendCode}
                      className="text-primary hover:underline"
                    >
                      Kodu tekrar gönder
                    </button>
                  </div>
                </div>
              </CardContent>
            </>
          )}
        </Card>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-muted-foreground">
          Sadece yetkili e-posta adresleri giriş yapabilir.
        </div>
      </div>
    </div>
  );
}
