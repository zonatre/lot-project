import { useEffect, useState } from 'react';
import { Toaster } from './components/ui/sonner';
import { LoginView } from './components/LoginView';
import { Sidebar } from './components/Sidebar';
import { ProductDashboard } from './components/ProductDashboard';
import { ProductDetailView } from './components/ProductDetailView';
import { LotHistoryView } from './components/LotHistoryView';
import { DataExportView } from './components/DataExportView';
import { ParasutProductMappingView } from './components/ParasutProductMappingView';

type View = 'dashboard' | 'product-detail' | 'lot-history' | 'parasut-mapping' | 'export';

interface AppState {
  isAuthenticated: boolean;
  view: View;
  selectedProductId: string | null;
  selectedLotId: string | null;
}

function parsePath(pathname: string): Pick<AppState, 'view' | 'selectedProductId' | 'selectedLotId'> {
  const parts = pathname.split('/').filter(Boolean);

  if (parts[0] === 'products' && parts[1]) {
    if (parts[2] === 'lots' && parts[3]) {
      return {
        view: 'lot-history',
        selectedProductId: parts[1],
        selectedLotId: parts[3],
      };
    }

    return {
      view: 'product-detail',
      selectedProductId: parts[1],
      selectedLotId: null,
    };
  }

  if (parts[0] === 'export') {
    return { view: 'export', selectedProductId: null, selectedLotId: null };
  }

  if (parts[0] === 'parasut-mapping') {
    return { view: 'parasut-mapping', selectedProductId: null, selectedLotId: null };
  }

  return { view: 'dashboard', selectedProductId: null, selectedLotId: null };
}

function buildPath(
  view: View,
  selectedProductId: string | null,
  selectedLotId: string | null,
): string {
  if (view === 'product-detail' && selectedProductId) {
    return `/products/${selectedProductId}`;
  }
  if (view === 'lot-history' && selectedProductId && selectedLotId) {
    return `/products/${selectedProductId}/lots/${selectedLotId}`;
  }
  if (view === 'export') return '/export';
  if (view === 'parasut-mapping') return '/parasut-mapping';
  return '/dashboard';
}

export default function App() {
  const [state, setState] = useState<AppState>({
    isAuthenticated: false,
    view: 'dashboard',
    selectedProductId: null,
    selectedLotId: null,
  });
  const [integrationConnected, setIntegrationConnected] = useState<boolean | null>(null);

  useEffect(() => {
    const onPopState = () => {
      const next = parsePath(window.location.pathname);
      setState((prev) => ({
        ...prev,
        ...next,
      }));
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!state.isAuthenticated) return;
    const nextPath = buildPath(state.view, state.selectedProductId, state.selectedLotId);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
  }, [state.isAuthenticated, state.view, state.selectedProductId, state.selectedLotId]);

  const handleLogin = () => {
    const next = parsePath(window.location.pathname);
    setState((prev) => ({
      ...prev,
      isAuthenticated: true,
      ...next,
    }));
  };

  const handleLogout = () => {
    setState({
      isAuthenticated: false,
      view: 'dashboard',
      selectedProductId: null,
      selectedLotId: null,
    });
    if (window.location.pathname !== '/dashboard') {
      window.history.pushState({}, '', '/dashboard');
    }
    setIntegrationConnected(null);
  };

  const handleNavigate = (view: string) => {
    setState((prev) => ({
      ...prev,
      view: view as View,
      selectedProductId: null,
      selectedLotId: null,
    }));
  };

  const handleNavigateToProduct = (productId: string) => {
    setState((prev) => ({
      ...prev,
      view: 'product-detail',
      selectedProductId: productId,
      selectedLotId: null,
    }));
  };

  const handleNavigateToLot = (lotId: string, productId: string) => {
    setState((prev) => ({
      ...prev,
      view: 'lot-history',
      selectedProductId: productId,
      selectedLotId: lotId,
    }));
  };

  const handleBackToDashboard = () => {
    setState((prev) => ({
      ...prev,
      view: 'dashboard',
      selectedProductId: null,
      selectedLotId: null,
    }));
  };

  const handleBackToProduct = () => {
    setState((prev) => ({
      ...prev,
      view: 'product-detail',
      selectedLotId: null,
    }));
  };

  if (!state.isAuthenticated) {
    return (
      <>
        <LoginView onLogin={handleLogin} />
        <Toaster />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        currentView={state.view}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        integrationConnected={integrationConnected}
      />
      
      <div className="ml-64">
        {state.view === 'dashboard' && (
          <ProductDashboard
            onNavigateToProduct={handleNavigateToProduct}
            onIntegrationStatusChange={setIntegrationConnected}
          />
        )}

        {state.view === 'product-detail' && state.selectedProductId && (
          <ProductDetailView
            productId={state.selectedProductId}
            onBack={handleBackToDashboard}
            onViewLot={handleNavigateToLot}
          />
        )}

        {state.view === 'lot-history' && state.selectedLotId && state.selectedProductId && (
          <LotHistoryView
            lotId={state.selectedLotId}
            productId={state.selectedProductId}
            onBack={handleBackToProduct}
          />
        )}

        {state.view === 'export' && <DataExportView />}

        {state.view === 'parasut-mapping' && <ParasutProductMappingView />}
      </div>

      <Toaster />
    </div>
  );
}
