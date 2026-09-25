import { useEffect, useState } from 'react';
import logo from './logo.png';
import { AiAssistantScreen } from './AI/aiAssistantScreen';
import { SalesPanel } from './components/SalesPanel';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { adicionarVenda, observarVendas } from './vendasService';
import { type Venda } from './types';

type TelaAtiva = 'vendas' | 'analises' | 'assistente';

export default function App() {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [telaAtiva, setTelaAtiva] = useState<TelaAtiva>('vendas');
  const [erroLeitura, setErroLeitura] = useState('');

  useEffect(() => {
    const unsubscribe = observarVendas(
      (dadosIniciais: Venda[]) => {
        setVendas(dadosIniciais);
        setErroLeitura('');
      },
      () => setErroLeitura('Não foi possível carregar as vendas cadastradas.')
    );

    return () => unsubscribe();
  }, []);

  const handleRegistrarVenda = async (venda: Omit<Venda, 'id' | 'dataRegistro'>) => {
    await adicionarVenda(venda);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(244,114,182,0.16),_transparent_32%),linear-gradient(135deg,_#fffaf7_0%,_#fdf2f8_100%)] px-3 py-4 text-stone-700 sm:px-5 lg:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <header className="rounded-4xl border border-stone-200/80 bg-white/80 p-4 shadow-[0_20px_60px_-24px_rgba(120,53,15,0.35)] backdrop-blur-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-semibold text-white">
                <img src={logo} alt="Logo" className="h-14 w-14 object-contain" />
              </div>
              <div>
                <h1 className="m-0 text-2xl font-semibold tracking-tight text-stone-900">Ponto & Etiqueta</h1>
                <p className="mt-1 text-sm text-stone-500">Gestão de clientes</p>
              </div>
            </div>

            <nav className="grid grid-cols-3 gap-2 rounded-2xl border border-stone-100 bg-stone-50 p-1.5 shadow-inner">
              <button
                type="button"
                onClick={() => setTelaAtiva('vendas')}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                  telaAtiva === 'vendas' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-500 hover:bg-white'
                }`}
              >
                Vendas
              </button>
              <button
                type="button"
                onClick={() => setTelaAtiva('analises')}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                  telaAtiva === 'analises' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-500 hover:bg-white'
                }`}
              >
                Análises
              </button>
              <button
                type="button"
                onClick={() => setTelaAtiva('assistente')}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                  telaAtiva === 'assistente' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-500 hover:bg-white'
                }`}
              >
                Assistente IA
              </button>
            </nav>
          </div>
        </header>

        <main className="rounded-[32px] border border-stone-200/80 bg-white/90 p-3 shadow-[0_20px_60px_-24px_rgba(120,53,15,0.28)] sm:p-4 lg:p-5">
          {erroLeitura ? (
            <p className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
              {erroLeitura}
            </p>
          ) : null}

          {telaAtiva === 'vendas' ? (
            <SalesPanel vendas={vendas} onRegistrarVenda={handleRegistrarVenda} />
          ) : telaAtiva === 'analises' ? (
            <AnalyticsPanel vendas={vendas} />
          ) : (
            <AiAssistantScreen vendas={vendas} />
          )}
        </main>
      </div>
    </div>
  );
}
