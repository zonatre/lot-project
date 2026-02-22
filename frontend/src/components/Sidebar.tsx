import { Package, FileText, Database, LayoutDashboard, LogOut, Link2 } from 'lucide-react';
import { Button } from './ui/button';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  integrationConnected: boolean | null;
}

export function Sidebar({ currentView, onNavigate, onLogout, integrationConnected }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Ürün Kontrol Paneli', icon: LayoutDashboard },
    { id: 'parasut-mapping', label: 'Paraşüt Ürün Eşleştirme', icon: Link2 },
    { id: 'export', label: 'Veri Dışa Aktarımı', icon: FileText },
  ];

  return (
    <div className="w-64 bg-sidebar text-sidebar-foreground h-screen fixed left-0 top-0 flex flex-col border-r border-sidebar-border">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <Package className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg">KRIJEN</h1>
            <p className="text-xs text-sidebar-foreground/60"> LOT Takibi</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  currentView === item.id
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-3">
        <div className="bg-sidebar-accent rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-4 h-4 text-primary" />
            <span className="text-xs">Entegrasyon Durumu</span>
          </div>
          {integrationConnected === null && (
            <div className="text-xs text-sidebar-foreground/60">Durum kontrol ediliyor...</div>
          )}
          {integrationConnected === true && (
            <div className="text-xs text-emerald-400">Paraşüt API&apos;ye Bağlı</div>
          )}
          {integrationConnected === false && (
            <div className="text-xs text-amber-300">Paraşüt API&apos;ye Bağlı Değil</div>
          )}
        </div>
        
        <Button
          variant="ghost"
          onClick={onLogout}
          className="w-full justify-start gap-2 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          <LogOut className="w-4 h-4" />
          Çıkış Yap
        </Button>
      </div>
    </div>
  );
}
