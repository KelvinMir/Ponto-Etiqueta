import { useMemo, useState } from 'react';
import { analisarDadosFinanceirosComIA } from './aiAssistant';
import { formatarMoeda, formatarPercentual, normalizarVendasParaAnalise } from './finance';
import { type ResultadoAssistenteIA, type Venda } from '../types';

interface AiAssistantScreenProps {
  vendas: Venda[];
}

const cardClass = 'rounded-2xl border border-stone-100 bg-white p-5 shadow-sm';

export function AiAssistantScreen({ vendas }: AiAssistantScreenProps) {
  const [resultado, setResultado] = useState<ResultadoAssistenteIA | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const dadosAnalise = useMemo(() => normalizarVendasParaAnalise(vendas), [vendas]);

  const handleAnalisar = async () => {
    setLoading(true);
    setErro('');

    try {
      const response = await analisarDadosFinanceirosComIA(dadosAnalise);
      setResultado(response);
    } catch (error) {
      console.error(error);
      setResultado(null);
      setErro(error instanceof Error ? error.message : 'Não foi possível gerar a análise com IA.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-5 text-left">
      <div className="flex flex-col gap-4 rounded-2xl border border-stone-100 bg-stone-50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-500">Assistente IA</p>
          <h2 className="mt-2 text-2xl font-light text-stone-800">Análise financeira inteligente</h2>
          <p className="mt-2 text-sm text-stone-500">
            A análise usa produtos, custos, ingredientes, preço de venda, quantidade vendida e lucro calculado.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAnalisar}
          disabled={loading}
          className="rounded-xl bg-stone-900 px-5 py-3 font-medium text-white shadow-lg shadow-stone-200 transition-all hover:bg-stone-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          {loading ? 'Analisando...' : 'Analisar com IA'}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ResumoCard titulo="Produtos" valor={String(dadosAnalise.resumo.totalProdutos)} />
        <ResumoCard titulo="Receita" valor={formatarMoeda(dadosAnalise.resumo.receitaTotal)} />
        <ResumoCard titulo="Lucro" valor={formatarMoeda(dadosAnalise.resumo.lucroTotal)} />
        <ResumoCard titulo="Margem média" valor={formatarPercentual(dadosAnalise.resumo.margemMedia)} />
      </div>

      {erro && (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {erro}
        </p>
      )}

      {loading && (
        <div className={cardClass}>
          <p className="text-sm font-medium text-stone-500">Gerando recomendações financeiras...</p>
        </div>
      )}

      {resultado && (
        <div className="space-y-4">
          <article className={cardClass}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-stone-800">Resultado</h3>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                {resultado.origem === 'ia' ? resultado.provider ?? 'IA' : 'Demo'}
              </span>
            </div>
            <p className="text-sm leading-6 text-stone-600">{resultado.resultado}</p>
          </article>

          <article className={cardClass}>
            <h3 className="mb-3 text-lg font-semibold text-stone-800">Sugestões</h3>
            <ul className="space-y-3 text-sm leading-6 text-stone-600">
              {resultado.sugestoes.map((sugestao) => (
                <li key={sugestao} className="rounded-xl bg-stone-50 px-4 py-3">
                  {sugestao}
                </li>
              ))}
            </ul>
          </article>

          <article className={cardClass}>
            <h3 className="mb-3 text-lg font-semibold text-stone-800">Relatório gerado</h3>
            <p className="whitespace-pre-line text-sm leading-6 text-stone-600">{resultado.relatorio}</p>
          </article>

          {resultado.avisos && resultado.avisos.length > 0 && (
            <article className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-amber-800">Avisos</h3>
              <ul className="space-y-2 text-sm text-amber-800">
                {resultado.avisos.map((aviso) => (
                  <li key={aviso}>{aviso}</li>
                ))}
              </ul>
            </article>
          )}
        </div>
      )}
    </section>
  );
}

function ResumoCard({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
      <span className="text-xs font-semibold uppercase tracking-widest text-stone-400">{titulo}</span>
      <strong className="mt-2 block text-lg text-stone-800">{valor}</strong>
    </div>
  );
}
