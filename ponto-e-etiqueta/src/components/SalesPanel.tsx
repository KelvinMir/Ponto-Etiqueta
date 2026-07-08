import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { formatarMoeda } from '../AI/finance';
import { observarClientes, salvarCliente, atualizarPagamentoVenda } from '../vendasService';
import { type Cliente, type FormaPagamento, type Venda } from '../types';

interface SalesPanelProps {
  vendas: Venda[];
  onRegistrarVenda: (venda: Omit<Venda, 'id' | 'dataRegistro'>) => Promise<void>;
}

interface ItemForm {
  descricao: string;
  quantidade: string;
}

interface FormState {
  nomeCliente: string;
  itens: ItemForm[];
  valorTotalCompra: string;
  formaPagamento: FormaPagamento;
  dataVenda: string;
  dataRecebimento: string;
}

const initialItem: ItemForm = {
  descricao: '',
  quantidade: '1',
};

const initialForm: FormState = {
  nomeCliente: '',
  itens: [{ ...initialItem }],
  valorTotalCompra: '',
  formaPagamento: 'PIX',
  dataVenda: '',
  dataRecebimento: '',
};

const labelClass = 'mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500';
const inputClass =
  'block w-full rounded-2xl border border-stone-200 bg-white/80 px-4 py-3 text-sm text-stone-700 shadow-sm outline-none transition focus:border-rose-300 focus:bg-white focus:ring-2 focus:ring-rose-100';

const formatarDataInput = (data: Venda['dataRecebimento'] | undefined) => {
  if (!data) return '';
  if (data instanceof Date) return data.toISOString().slice(0, 10);
  if (typeof data === 'object' && 'toDate' in data && typeof data.toDate === 'function') {
    return data.toDate().toISOString().slice(0, 10);
  }
  return '';
};

export function SalesPanel({ vendas, onRegistrarVenda }: SalesPanelProps) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteBusca, setClienteBusca] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [clienteForm, setClienteForm] = useState({ nome: '', telefone: '', observacoes: '' });
  const [clienteSaving, setClienteSaving] = useState(false);
  const [clienteErro, setClienteErro] = useState('');
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pagamentos, setPagamentos] = useState<Record<string, { valorRecebido: string; dataRecebimento: string }>>({});

  useEffect(() => {
    const unsubscribe = observarClientes(
      (clientesAtualizados) => setClientes(clientesAtualizados),
      () => setClienteErro('Não foi possível carregar os clientes cadastrados.')
    );

    return () => unsubscribe();
  }, []);

  const clientesFiltrados = useMemo(() => {
    const busca = clienteBusca.trim().toLowerCase();

    if (!busca) {
      return clientes.slice(0, 6);
    }

    return clientes
      .filter((cliente) => {
        const nome = cliente.nome?.toLowerCase() ?? '';
        const telefone = cliente.telefone?.toLowerCase() ?? '';
        const observacoes = cliente.observacoes?.toLowerCase() ?? '';
        return nome.includes(busca) || telefone.includes(busca) || observacoes.includes(busca);
      })
      .slice(0, 6);
  }, [clienteBusca, clientes]);

  const atualizarCampo = (campo: keyof FormState, valor: string | number) => {
    setForm((current) => ({ ...current, [campo]: valor }));
  };

  const atualizarItem = (index: number, campo: keyof ItemForm, valor: string) => {
    setForm((current) => ({
      ...current,
      itens: current.itens.map((item, itemIndex) => (itemIndex === index ? { ...item, [campo]: valor } : item)),
    }));
  };

  const adicionarItem = () => {
    setForm((current) => ({ ...current, itens: [...current.itens, { ...initialItem }] }));
  };

  const removerItem = (index: number) => {
    setForm((current) => ({
      ...current,
      itens: current.itens.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const clientePronto = Boolean(clienteSelecionado);

  const selecionarCliente = (cliente: Cliente) => {
    setClienteBusca(cliente.nome);
    setClienteSelecionado(cliente);
    setForm((current) => ({ ...current, nomeCliente: cliente.nome }));
    setErro('');
  };

  const handleClienteSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setClienteErro('');

    const nome = clienteForm.nome.trim();
    if (!nome) {
      setClienteErro('Informe o nome do cliente para salvar.');
      return;
    }

    try {
      setClienteSaving(true);
      const clienteSalvo = await salvarCliente({
        nome,
        telefone: clienteForm.telefone,
        observacoes: clienteForm.observacoes,
      });

      setClienteForm({ nome: '', telefone: '', observacoes: '' });
      setClienteBusca(clienteSalvo.nome);
      setClienteSelecionado({
        id: clienteSalvo.id,
        nome: clienteSalvo.nome,
        telefone: clienteSalvo.telefone,
        telefoneDigitos: clienteSalvo.telefoneDigitos,
        observacoes: clienteSalvo.observacoes,
      });
      setForm((current) => ({ ...current, nomeCliente: clienteSalvo.nome }));
    } catch (error) {
      console.error(error);
      setClienteErro(error instanceof Error ? error.message : 'Não foi possível salvar o cliente. Tente novamente.');
    } finally {
      setClienteSaving(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErro('');

    if (!clientePronto) {
      setErro('Pesquise ou cadastre o cliente antes de registrar a compra.');
      return;
    }

    const itensValidos = form.itens
      .map((item) => ({
        descricao: item.descricao.trim(),
        quantidade: Math.max(1, Number(item.quantidade || 1)),
      }))
      .filter((item) => item.descricao);

    if (itensValidos.length === 0) {
      setErro('Adicione pelo menos uma peça vendida.');
      return;
    }

    const valorTotalCompra = Number(form.valorTotalCompra);
    if (!Number.isFinite(valorTotalCompra) || valorTotalCompra <= 0) {
      setErro('Informe o valor total da compra.');
      return;
    }

    if (!form.dataVenda) {
      setErro('Informe a data da venda.');
      return;
    }

    try {
      setSaving(true);
      await onRegistrarVenda({
        nomeCliente: form.nomeCliente.trim(),
        produto: itensValidos[0].descricao,
        descricaoPeca: itensValidos[0].descricao,
        valor: valorTotalCompra,
        valorTotalCompra,
        valorRecebido: 0,
        valorAindaPagar: valorTotalCompra,
        precoVenda: valorTotalCompra / itensValidos.reduce((sum, item) => sum + item.quantidade, 0),
        custoProducao: 0,
        quantidadeVendida: itensValidos.reduce((sum, item) => sum + item.quantidade, 0),
        quantidadePecas: itensValidos.reduce((sum, item) => sum + item.quantidade, 0),
        pecas: itensValidos.map((item) => item.descricao),
        itens: itensValidos,
        lucroCalculado: valorTotalCompra,
        formaPagamento: form.formaPagamento,
        quantidadeParcelas: 1,
        dataCompra: new Date(form.dataVenda),
        dataRecebimento: new Date(form.dataRecebimento || form.dataVenda),
      });
      setForm({ ...initialForm, nomeCliente: form.nomeCliente.trim() });
      setErro('');
    } catch (error) {
      console.error(error);
      setErro('Não foi possível registrar a compra. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handlePagamentoChange = (vendaId: string, valor: string, dataRecebimento: string) => {
    setPagamentos((current) => ({
      ...current,
      [vendaId]: { valorRecebido: valor, dataRecebimento },
    }));
  };

  const handleSalvarPagamento = async (venda: Venda) => {
    if (!venda.id) return;

    const entrada = pagamentos[venda.id] ?? {
      valorRecebido: String(venda.valorRecebido ?? 0),
      dataRecebimento: formatarDataInput(venda.dataRecebimento),
    };

    const valorRecebido = Math.max(0, Number(entrada.valorRecebido || 0));
    const dataRecebimento = entrada.dataRecebimento ? new Date(entrada.dataRecebimento) : undefined;

    try {
      await atualizarPagamentoVenda(venda.id, { valorRecebido, dataRecebimento });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">Passo 1</p>
            <h3 className="mt-1 text-lg font-semibold text-stone-800">Cliente</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelClass}>Buscar cliente</label>
              <input
                type="text"
                value={clienteBusca}
                onChange={(event) => setClienteBusca(event.target.value)}
                className={inputClass}
                placeholder="Digite o nome para buscar"
              />
              <p className="mt-2 text-sm text-stone-500">Caso não exista, adicione abaixo e siga para a compra.</p>
            </div>

            {clienteBusca.trim() && clientesFiltrados.length > 0 ? (
              <ul className="rounded-2xl border border-stone-100 bg-stone-50 p-2">
                {clientesFiltrados.map((cliente) => (
                  <li key={cliente.id ?? cliente.telefoneDigitos ?? cliente.nome}>
                    <button
                      type="button"
                      onClick={() => selecionarCliente(cliente)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition hover:bg-white"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-stone-800">{cliente.nome}</span>
                        {cliente.telefone ? <span className="mt-1 block text-xs text-stone-500">{cliente.telefone}</span> : null}
                      </span>
                      <span className="text-xs font-medium text-rose-500">Selecionar</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {clienteBusca.trim() && clientesFiltrados.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-500">
                Nenhum cliente encontrado. Cadastre um novo abaixo.
              </p>
            ) : null}

            {clienteErro ? <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{clienteErro}</p> : null}

            <div className="rounded-3xl border border-stone-100 bg-stone-50 p-4">
              <h4 className="text-sm font-semibold text-stone-800">Adicionar cliente novo</h4>
              <form onSubmit={handleClienteSubmit} className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className={labelClass}>Nome</label>
                  <input
                    type="text"
                    value={clienteForm.nome}
                    onChange={(event) => setClienteForm((current) => ({ ...current, nome: event.target.value }))}
                    className={inputClass}
                    placeholder="Nome do cliente"
                  />
                </div>
                <div>
                  <label className={labelClass}>Telefone</label>
                  <input
                    type="tel"
                    value={clienteForm.telefone}
                    onChange={(event) => setClienteForm((current) => ({ ...current, telefone: event.target.value }))}
                    className={inputClass}
                    placeholder="(11) 99999-0000"
                  />
                </div>
                <div>
                  <label className={labelClass}>Observações</label>
                  <input
                    type="text"
                    value={clienteForm.observacoes}
                    onChange={(event) => setClienteForm((current) => ({ ...current, observacoes: event.target.value }))}
                    className={inputClass}
                    placeholder="Opcional"
                  />
                </div>
                <button
                  type="submit"
                  disabled={clienteSaving}
                  className="md:col-span-2 rounded-2xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
                >
                  {clienteSaving ? 'Salvando...' : 'Salvar cliente'}
                </button>
              </form>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {erro ? (
              <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
                {erro}
              </p>
            ) : null}

            {!clientePronto ? (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Finalize a pesquisa ou o cadastro do cliente para registrar a compra.
              </div>
            ) : null}

            <div className="rounded-3xl border border-stone-100 bg-stone-50 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-800">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 text-rose-600">2</span>
                Itens da compra
              </div>

              <div className="space-y-3">
                {form.itens.map((item, index) => (
                  <div key={`item-${index}`} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_auto]">
                    <div>
                      <label className={labelClass}>Peça / produto</label>
                      <input
                        type="text"
                        value={item.descricao}
                        onChange={(event) => atualizarItem(index, 'descricao', event.target.value)}
                        className={inputClass}
                        placeholder="Ex.: blusa azul"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Quantidade</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantidade}
                        onChange={(event) => atualizarItem(index, 'quantidade', event.target.value)}
                        className={inputClass}
                      />
                    </div>
                    {form.itens.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removerItem(index)}
                        className="self-end rounded-2xl border border-stone-200 px-3 py-3 text-sm font-medium text-stone-600 transition hover:border-rose-300 hover:text-rose-600"
                      >
                        Remover
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={adicionarItem}
                className="mt-3 rounded-2xl border border-dashed border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 transition hover:border-rose-300 hover:text-rose-600"
              >
                Adicionar outra peça
              </button>
            </div>

            <div className="rounded-3xl border border-stone-100 bg-stone-50 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-800">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 text-rose-600">3</span>
                Valor e data
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Valor total</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.valorTotalCompra}
                    onChange={(event) => atualizarCampo('valorTotalCompra', event.target.value)}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Pagamento</label>
                  <select
                    value={form.formaPagamento}
                    onChange={(event) => atualizarCampo('formaPagamento', event.target.value as FormaPagamento)}
                    className={inputClass}
                  >
                    <option value="PIX">PIX</option>
                    <option value="Dinheiro">Dinheiro</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Data da venda</label>
                  <input
                    type="date"
                    value={form.dataVenda}
                    onChange={(event) => atualizarCampo('dataVenda', event.target.value)}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Data de recebimento</label>
                  <input
                    type="date"
                    value={form.dataRecebimento}
                    onChange={(event) => atualizarCampo('dataRecebimento', event.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-2xl bg-stone-900 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-stone-200 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
            >
              {saving ? 'Registrando...' : 'Registrar venda'}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">Vendas</p>
              <h3 className="mt-1 text-lg font-semibold text-stone-800">Resumo das vendas</h3>
            </div>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">{vendas.length} itens</span>
          </div>
          <SalesList
            vendas={vendas}
            pagamentos={pagamentos}
            onPagamentoChange={handlePagamentoChange}
            onSalvarPagamento={handleSalvarPagamento}
            expandedId={expandedId}
            onToggle={(id) => setExpandedId((current) => (current === id ? null : id))}
          />
        </section>
      </div>
    </div>
  );
}

function SalesList({
  vendas,
  pagamentos,
  onPagamentoChange,
  onSalvarPagamento,
  expandedId,
  onToggle,
}: {
  vendas: Venda[];
  pagamentos: Record<string, { valorRecebido: string; dataRecebimento: string }>;
  onPagamentoChange: (id: string, valor: string, dataRecebimento: string) => void;
  onSalvarPagamento: (venda: Venda) => Promise<void>;
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  if (vendas.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-6 text-center text-sm text-stone-500">
        Nenhuma venda registrada.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {vendas.map((venda) => {
        const valorTotal = Number(venda.valorTotalCompra ?? venda.valor ?? 0);
        const valorRecebidoAtual = Number(pagamentos[venda.id ?? '']?.valorRecebido ?? venda.valorRecebido ?? 0);
        const restante = Math.max(0, valorTotal - valorRecebidoAtual);
        const expandido = expandedId === venda.id;

        return (
          <li key={venda.id ?? `${venda.nomeCliente}-${venda.descricaoPeca}`} className="rounded-[22px] border border-stone-100 bg-white p-4 shadow-sm">
            <button type="button" onClick={() => venda.id && onToggle(venda.id)} className="flex w-full items-start justify-between gap-3 text-left">
              <div>
                <span className="block text-sm font-semibold text-stone-800">{venda.nomeCliente}</span>
                <span className="mt-1 block text-sm text-stone-500">{formatarMoeda(restante)} ainda a pagar</span>
              </div>
              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-600">
                {expandido ? 'Fechar' : 'Abrir'}
              </span>
            </button>

            {expandido ? (
              <div className="mt-4 space-y-4 border-t border-stone-100 pt-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">Peças vendidas</p>
                  <ul className="mt-2 space-y-2">
                    {(venda.itens && venda.itens.length > 0 ? venda.itens : [{ descricao: venda.descricaoPeca, quantidade: venda.quantidadePecas ?? 1 }]).map((item, index) => (
                      <li key={`${venda.id ?? 'venda'}-${index}`} className="rounded-2xl bg-stone-50 px-3 py-2 text-sm text-stone-600">
                        {item.descricao} · qtd. {item.quantidade}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">Data de recebimento</label>
                    <input
                      type="date"
                      value={pagamentos[venda.id ?? '']?.dataRecebimento ?? formatarDataInput(venda.dataRecebimento)}
                      onChange={(event) => venda.id && onPagamentoChange(venda.id, pagamentos[venda.id ?? '']?.valorRecebido ?? String(venda.valorRecebido ?? 0), event.target.value)}
                      className="block w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">Valor recebido</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={pagamentos[venda.id ?? '']?.valorRecebido ?? String(venda.valorRecebido ?? 0)}
                      onChange={(event) => venda.id && onPagamentoChange(venda.id, event.target.value, pagamentos[venda.id ?? '']?.dataRecebimento ?? formatarDataInput(venda.dataRecebimento))}
                      className="block w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-stone-700">
                  Valor restante: <strong className="text-stone-900">{formatarMoeda(restante)}</strong>
                </div>

                <button
                  type="button"
                  onClick={() => onSalvarPagamento(venda)}
                  className="rounded-2xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800"
                >
                  Salvar pagamento
                </button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
