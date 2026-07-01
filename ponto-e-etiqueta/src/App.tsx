import { useEffect, useState } from 'react';
import heroImage from './assets/hero.png';
import { AiAssistantScreen } from './AI/aiAssistantScreen';
import { SalesPanel } from './components/SalesPanel';
import { adicionarVenda, observarVendas } from './vendasService';
import { type Venda } from './types';

type TelaAtiva = 'vendas' | 'assistente';

export default function App() {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [telaAtiva, setTelaAtiva] = useState<TelaAtiva>('vendas');
  const [erroLeitura, setErroLeitura] = useState('');

  useEffect(() => {
    // O listener escuta o backend em tempo real e atualiza a interface
    const unsubscribe = observarVendas(
      (dadosIniciais: Venda[]) => {
        setVendas(dadosIniciais);
        setErroLeitura('');
      },
      () => setErroLeitura('Não foi possível carregar as vendas cadastradas.')
    );
    
    // Clean up function: Remove o listener quando o componente é desmontado
    return () => unsubscribe();
  }, []);

  const handleRegistrarVenda = async (venda: Omit<Venda, 'id' | 'dataRegistro'>) => {
    await adicionarVenda(venda);
  };

  return (
    <div className="min-h-screen bg-[#fdfbf7] p-4 font-sans text-stone-700 sm:p-8">
      <header className="mx-auto mb-8 flex max-w-4xl flex-col gap-5 pt-4 text-left sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <img src={heroImage} alt="" className="h-16 w-16 object-contain" />
          <div>
            <h1 className="m-0 text-2xl font-light tracking-tight text-stone-800">Ponto & Etiqueta</h1>
            <p className="mt-1 text-sm italic text-stone-500">Sua caderneta de vendas</p>
          </div>
        </div>

        <nav className="grid grid-cols-2 gap-2 rounded-2xl border border-stone-100 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setTelaAtiva('vendas')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              telaAtiva === 'vendas' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-500 hover:bg-stone-50'
            }`}
          >
            Vendas
          </button>
          <button
            type="button"
            onClick={() => setTelaAtiva('assistente')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              telaAtiva === 'assistente' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-500 hover:bg-stone-50'
            }`}
          >
            Assistente IA
          </button>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl rounded-3xl border border-stone-100 bg-white p-5 text-left shadow-xl shadow-stone-200/40 sm:p-8">
        {erroLeitura && (
          <p className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
            {erroLeitura}
          </p>
        )}

        {telaAtiva === 'vendas' ? (
          <SalesPanel vendas={vendas} onRegistrarVenda={handleRegistrarVenda} />
        ) : (
          <AiAssistantScreen vendas={vendas} />
        )}
      </main>
    </div>
  );
}
