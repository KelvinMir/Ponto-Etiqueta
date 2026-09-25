import { useMemo, useState } from "react";
import { formatarMoeda } from "../AI/finance";
import { type DataCompat, type Venda } from "../types";

interface AnalyticsPanelProps {
  vendas: Venda[];
}

interface ClienteResumo {
  nome: string;
  total: number;
  compras: number;
  pecas: number;
}

interface PendenciaPagamento {
  venda: Venda;
  total: number;
  recebido: number;
  restante: number;
  dataPagamento: Date | null;
}

const obterData = (data: DataCompat | undefined) => {
  if (!data) return null;
  if (data instanceof Date) return data;
  if (typeof data === "object" && "toDate" in data && typeof data.toDate === "function") {
    return data.toDate();
  }
  return null;
};

const obterMesAtual = () => {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
};

const formatarQuantidade = (valor: number) => new Intl.NumberFormat("pt-BR").format(valor);

const obterTotal = (venda: Venda) => Number(venda.valorTotalCompra ?? venda.valor ?? 0);

const obterPecas = (venda: Venda) => Number(
  venda.quantidadePecas ?? venda.quantidadeVendida ?? venda.itens?.reduce((total, item) => total + item.quantidade, 0) ?? 0,
);

const formatarData = (data: Date | null) => data
  ? data.toLocaleDateString("pt-BR")
  : "Sem data";

export function AnalyticsPanel({ vendas }: AnalyticsPanelProps) {
  const [mesSelecionado, setMesSelecionado] = useState(obterMesAtual);

  const analise = useMemo(() => {
    const [ano, mes] = mesSelecionado.split("-").map(Number);
    const vendasDoMes = vendas.filter((venda) => {
      const data = obterData(venda.dataCompra ?? venda.dataRegistro);
      return data?.getFullYear() === ano && data.getMonth() + 1 === mes;
    });

    const clientes = vendasDoMes.reduce<Map<string, ClienteResumo>>((resumo, venda) => {
      const chave = venda.clienteId ?? venda.nomeCliente.trim().toLowerCase();
      const atual = resumo.get(chave) ?? { nome: venda.nomeCliente, total: 0, compras: 0, pecas: 0 };
      atual.total += obterTotal(venda);
      atual.compras += 1;
      atual.pecas += obterPecas(venda);
      resumo.set(chave, atual);
      return resumo;
    }, new Map());

    const ranking = [...clientes.values()].sort((clienteA, clienteB) => clienteB.total - clienteA.total);
    const totalVendido = vendasDoMes.reduce((total, venda) => total + obterTotal(venda), 0);
    const totalPecas = vendasDoMes.reduce((total, venda) => total + obterPecas(venda), 0);

    const pendencias = vendas
      .map<PendenciaPagamento>((venda) => {
        const total = obterTotal(venda);
        const recebido = Math.max(0, Number(venda.valorRecebido ?? 0));
        return {
          venda,
          total,
          recebido,
          restante: Math.max(0, Number(venda.valorAindaPagar ?? total - recebido)),
          dataPagamento: obterData(venda.dataRecebimento),
        };
      })
      .filter((pendencia) => pendencia.restante > 0)
      .sort((pendenciaA, pendenciaB) => (pendenciaB.dataPagamento?.getTime() ?? 0) - (pendenciaA.dataPagamento?.getTime() ?? 0));

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const inadimplentes = pendencias.filter((pendencia) => pendencia.dataPagamento && pendencia.dataPagamento < hoje);
    const totalPendente = pendencias.reduce((total, pendencia) => total + pendencia.restante, 0);

    return {
      vendasDoMes,
      ranking,
      totalVendido,
      totalPecas,
      ticketMedio: vendasDoMes.length > 0 ? totalVendido / vendasDoMes.length : 0,
      pendencias,
      inadimplentes,
      totalPendente,
    };
  }, [mesSelecionado, vendas]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">Visão financeira</p>
            <h2 className="mt-1 text-xl font-semibold text-stone-900">Análises de vendas</h2>
            <p className="mt-1 text-sm text-stone-500">Veja quem mais comprou e quanto foi vendido no período.</p>
          </div>
          <div>
            <label htmlFor="mes-analise" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">Mês analisado</label>
            <input id="mes-analise" type="month" value={mesSelecionado} onChange={(event) => setMesSelecionado(event.target.value)} className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700 shadow-sm outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Pagamentos pendentes" value={formatarMoeda(analise.totalPendente)} />
        <MetricCard label="Compras em atraso" value={formatarQuantidade(analise.inadimplentes.length)} />
        <MetricCard label="Lembretes ativos" value={formatarQuantidade(analise.pendencias.length)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <PaymentReminderList title="Lembretes de pagamento" description="Ordenados pela última data de pagamento, da mais recente para a mais antiga." pendencias={analise.pendencias} />
        <PaymentReminderList title="Inadimplência" description="Compras com saldo pendente cuja data de recebimento já passou." pendencias={analise.inadimplentes} overdue />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total vendido" value={formatarMoeda(analise.totalVendido)} />
        <MetricCard label="Compras no mês" value={formatarQuantidade(analise.vendasDoMes.length)} />
        <MetricCard label="Peças vendidas" value={formatarQuantidade(analise.totalPecas)} />
        <MetricCard label="Ticket médio" value={formatarMoeda(analise.ticketMedio)} />
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">Ranking</p>
            <h3 className="mt-1 text-lg font-semibold text-stone-800">Clientes que mais compraram</h3>
          </div>
          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">{analise.ranking.length} clientes</span>
        </div>

        {analise.ranking.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-6 text-center text-sm text-stone-500">Nenhuma venda encontrada neste mês.</div>
        ) : (
          <ol className="space-y-3">
            {analise.ranking.map((cliente, index) => (
              <li key={`${cliente.nome}-${index}`} className="flex items-center gap-3 rounded-2xl border border-stone-100 px-3 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-50 text-sm font-semibold text-rose-600">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-stone-800">{cliente.nome}</p>
                  <p className="mt-1 text-xs text-stone-500">{cliente.compras} compra(s) · {cliente.pecas} peça(s)</p>
                </div>
                <strong className="shrink-0 text-sm text-stone-900">{formatarMoeda(cliente.total)}</strong>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">Movimentação</p>
            <h3 className="mt-1 text-lg font-semibold text-stone-800">Histórico de compras</h3>
          </div>
          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">{analise.vendasDoMes.length} registros</span>
        </div>
        {analise.vendasDoMes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-6 text-center text-sm text-stone-500">Nenhum registro neste mês.</div>
        ) : (
          <ul className="space-y-2">
            {[...analise.vendasDoMes].sort((vendaA, vendaB) => (obterData(vendaB.dataCompra ?? vendaB.dataRegistro)?.getTime() ?? 0) - (obterData(vendaA.dataCompra ?? vendaA.dataRegistro)?.getTime() ?? 0)).map((venda) => {
              const total = obterTotal(venda);
              const recebido = Math.max(0, Number(venda.valorRecebido ?? 0));
              return (
                <li key={venda.id ?? `${venda.nomeCliente}-${formatarData(obterData(venda.dataCompra ?? venda.dataRegistro))}`} className="flex flex-col gap-2 rounded-2xl border border-stone-100 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-stone-800">{venda.nomeCliente}</p>
                    <p className="mt-1 text-xs text-stone-500">{formatarData(obterData(venda.dataCompra ?? venda.dataRegistro))} · {obterPecas(venda)} peça(s) · {venda.quantidadeParcelas ?? 1}x</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-semibold text-stone-900">{formatarMoeda(total)}</p>
                    <p className={`mt-1 text-xs ${total - recebido > 0 ? "text-amber-700" : "text-emerald-700"}`}>{total - recebido > 0 ? `${formatarMoeda(Math.max(0, total - recebido))} pendente` : "Pago"}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function PaymentReminderList({ title, description, pendencias, overdue = false }: { title: string; description: string; pendencias: PendenciaPagamento[]; overdue?: boolean }) {
  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">Financeiro</p>
        <h3 className="mt-1 text-lg font-semibold text-stone-800">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-stone-500">{description}</p>
      </div>
      {pendencias.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-5 text-center text-sm text-stone-500">Nenhum pagamento nesta situação.</div>
      ) : (
        <ul className="space-y-2">
          {pendencias.map((pendencia) => (
            <li key={pendencia.venda.id ?? `${pendencia.venda.nomeCliente}-${pendencia.restante}`} className="rounded-2xl border border-stone-100 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-stone-800">{pendencia.venda.nomeCliente}</p>
                  <p className="mt-1 text-xs text-stone-500">Último recebimento: {formatarData(pendencia.dataPagamento)}{overdue ? " · em atraso" : ""}</p>
                </div>
                <strong className="shrink-0 text-sm text-amber-700">{formatarMoeda(pendencia.restante)}</strong>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-stone-500"><span>{pendencia.venda.formaPagamento} · {pendencia.venda.quantidadeParcelas ?? 1}x</span><span>{formatarMoeda(pendencia.recebido)} recebido</span></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">{value}</p>
    </div>
  );
}
