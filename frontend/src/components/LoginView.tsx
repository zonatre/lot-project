import { useState } from 'react';
import { Package, Mail, Lock, ArrowRight } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { toast } from 'sonner';

interface LoginViewProps {
  onLogin: () => void;
}

export function LoginView({ onLogin }: LoginViewProps) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      toast.error('Lütfen geçerli bir e-posta adresi girin');
      return;
    }

    setIsLoading(true);
    
    // Simulate sending email
    setTimeout(() => {
      setIsLoading(false);
      setStep('code');
      toast.success('Doğrulama kodu e-postanıza gönderildi!', {
        description: 'Lütfen 6 haneli kodu girin',
      });
    }, 1500);
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

  const handleCodeSubmit = (fullCode?: string) => {
    const codeToVerify = fullCode || code.join('');
    
    if (codeToVerify.length !== 6) {
      toast.error('Lütfen 6 haneli doğrulama kodunu girin');
      return;
    }

    setIsLoading(true);

    // Simulate code verification
    setTimeout(() => {
      setIsLoading(false);
      
      // Accept any 6-digit code for demo
      toast.success('Giriş başarılı!');
      setTimeout(() => {
        onLogin();
      }, 500);
    }, 1000);
  };

  const handleResendCode = () => {
    setCode(['', '', '', '', '', '']);
    toast.success('Yeni doğrulama kodu gönderildi!');
    const firstInput = document.getElementById('code-0');
    firstInput?.focus();
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
          Demo amaçlı: Herhangi bir 6 haneli kod kabul edilir
        </div>
      </div>
    </div>
  );
}
