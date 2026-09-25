import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { formatarMoeda } from "../AI/finance";
import {
  atualizarCliente,
  atualizarPagamentoVenda,
  excluirCliente,
  extrairDigitosTelefone,
  formatarTelefoneCliente,
  observarClientes,
  salvarCliente,
  telefoneCelularValido,
} from "../vendasService";
import { type Cliente, type FormaPagamento, type Venda } from "../types";

interface SalesPanelProps {
  vendas: Venda[];
  onRegistrarVenda: (
    venda: Omit<Venda, "id" | "dataRegistro">,
  ) => Promise<void>;
}

interface ItemForm {
  descricao: string;
  quantidade: string;
  valor: string;
}

interface FormState {
  nomeCliente: string;
  itens: ItemForm[];
  aplicarDesconto: boolean;
  percentualDesconto: string;
  formaPagamento: FormaPagamento;
  dataVenda: string;
  dataRecebimento: string;
  quantidadeParcelas: string;
}

type VendaPendente = Omit<Venda, "id" | "dataRegistro">;

const initialItem: ItemForm = {
  descricao: "",
  quantidade: "1",
  valor: "",
};

const initialForm: FormState = {
  nomeCliente: "",
  itens: [{ ...initialItem }],
  aplicarDesconto: false,
  percentualDesconto: "",
  formaPagamento: "PIX",
  dataVenda: "",
  dataRecebimento: "",
  quantidadeParcelas: "1",
};

const labelClass =
  "mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500";
const inputClass =
  "block w-full rounded-2xl border border-stone-200 bg-white/80 px-4 py-3 text-sm text-stone-700 shadow-sm outline-none transition focus:border-rose-300 focus:bg-white focus:ring-2 focus:ring-rose-100";

const formatarDataInput = (data: Venda["dataRecebimento"] | undefined) => {
  if (!data) return "";
  if (data instanceof Date) return data.toISOString().slice(0, 10);
  if (
    typeof data === "object" &&
    "toDate" in data &&
    typeof data.toDate === "function"
  ) {
    return data.toDate().toISOString().slice(0, 10);
  }
  return "";
};

const formatarDataLegivel = (data: string) => {
  if (!data) return "Não informado";
  const [ano, mes, dia] = data.split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data;
};

const normalizarBusca = (valor: string) =>
  valor
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

const atualizarClienteNaLista = (
  lista: Cliente[],
  clienteAtualizado: Cliente,
) => {
  const semDuplicar = lista.filter(
    (cliente) => cliente.id !== clienteAtualizado.id,
  );
  return [...semDuplicar, clienteAtualizado].sort((clienteA, clienteB) =>
    clienteA.nome.localeCompare(clienteB.nome, "pt-BR", {
      sensitivity: "base",
    }),
  );
};

export function SalesPanel({ vendas, onRegistrarVenda }: SalesPanelProps) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteBusca, setClienteBusca] = useState("");
  const [clienteBuscaDebounced, setClienteBuscaDebounced] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(
    null,
  );
  const [clienteForm, setClienteForm] = useState({
    nome: "",
    telefone: "",
    observacoes: "",
  });
  const [clienteErro, setClienteErro] = useState("");
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [clienteExcluindo, setClienteExcluindo] = useState<Cliente | null>(
    null,
  );
  const [clienteModalSaving, setClienteModalSaving] = useState(false);
  const [clienteModalErro, setClienteModalErro] = useState("");
  const [clienteCadastroPendente, setClienteCadastroPendente] = useState<{
    nome: string;
    telefone: string;
    observacoes: string;
  } | null>(null);
  const [clienteEdicaoPendente, setClienteEdicaoPendente] = useState<{
    cliente: Cliente;
    dados: { nome: string; telefone: string; observacoes: string };
  } | null>(null);
  const [vendaPendente, setVendaPendente] = useState<VendaPendente | null>(null);
  const clienteActionInFlight = useRef(false);
  const [erro, setErro] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pagamentos, setPagamentos] = useState<
    Record<string, { valorRecebido: string; dataRecebimento: string }>
  >({});

  useEffect(() => {
    const unsubscribe = observarClientes(
      (clientesAtualizados) => {
        setClientes(clientesAtualizados);
        setClienteErro("");
      },
      () =>
        setClienteErro("Não foi possível carregar os clientes cadastrados."),
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setClienteBuscaDebounced(clienteBusca);
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [clienteBusca]);

  const clientesFiltrados = useMemo(() => {
    const busca = normalizarBusca(clienteBuscaDebounced);
    const buscaDigitos = extrairDigitosTelefone(clienteBuscaDebounced);

    if (!busca) {
      return clientes.slice(0, 6);
    }

    return clientes
      .filter((cliente) => {
        const nome = normalizarBusca(cliente.nome ?? "");
        const telefone = extrairDigitosTelefone(
          cliente.telefone ?? cliente.telefoneDigitos ?? "",
        );
        const observacoes = normalizarBusca(cliente.observacoes ?? "");
        return (
          nome.includes(busca) ||
          observacoes.includes(busca) ||
          Boolean(buscaDigitos && telefone.includes(buscaDigitos))
        );
      })
      .slice(0, 6);
  }, [clienteBuscaDebounced, clientes]);

  const atualizarCampo = (
    campo: keyof FormState,
    valor: string | number | boolean,
  ) => {
    setForm((current) => ({ ...current, [campo]: valor }));
  };

  const atualizarItem = (
    index: number,
    campo: keyof ItemForm,
    valor: string,
  ) => {
    setForm((current) => ({
      ...current,
      itens: current.itens.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [campo]: valor } : item,
      ),
    }));
  };

  const adicionarItem = () => {
    setForm((current) => ({
      ...current,
      itens: [...current.itens, { ...initialItem }],
    }));
  };

  const removerItem = (index: number) => {
    setForm((current) => ({
      ...current,
      itens: current.itens.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const clientePronto = Boolean(clienteSelecionado);
  const subtotalCompra = useMemo(
    () =>
      form.itens.reduce(
        (total, item) =>
          total + (Number(item.valor) || 0) * (Number(item.quantidade) || 0),
        0,
      ),
    [form.itens],
  );
  const percentualDesconto = Math.min(
    100,
    Math.max(0, Number(form.percentualDesconto) || 0),
  );
  const valorTotalCalculado = form.aplicarDesconto
    ? subtotalCompra * (1 - percentualDesconto / 100)
    : subtotalCompra;
  const itensProntos =
    clientePronto &&
    form.itens.some(
      (item) =>
        item.descricao.trim() &&
        Number(item.quantidade) >= 1 &&
        Number(item.valor) > 0,
    );
  const pagamentoPronto =
    itensProntos && valorTotalCalculado > 0 && Boolean(form.dataVenda);

  const selecionarCliente = (cliente: Cliente) => {
    setClienteBusca(cliente.nome);
    setClienteSelecionado(cliente);
    setForm((current) => ({ ...current, nomeCliente: cliente.nome }));
    setErro("");
  };

  const handleClienteBuscaChange = (valor: string) => {
    setClienteBusca(valor);
    if (
      clienteSelecionado &&
      normalizarBusca(valor) !== normalizarBusca(clienteSelecionado.nome)
    ) {
      setClienteSelecionado(null);
      setForm((current) => ({ ...current, nomeCliente: "" }));
    }
  };

  const trocarCliente = () => {
    setClienteSelecionado(null);
    setClienteBusca("");
    setForm((current) => ({ ...current, nomeCliente: "" }));
    setErro("");
  };

  const abrirEdicaoCliente = (cliente: Cliente) => {
    setClienteModalErro("");
    setClienteForm({
      nome: cliente.nome,
      telefone: cliente.telefone ?? "",
      observacoes: cliente.observacoes ?? "",
    });
    setClienteEditando(cliente);
  };

  const fecharEdicaoCliente = () => {
    if (clienteModalSaving) return;
    setClienteEditando(null);
    setClienteModalErro("");
  };

  const handleEditarCliente = async (event: FormEvent) => {
    event.preventDefault();
    if (!clienteEditando?.id) return;

    if (
      !clienteForm.nome.trim() ||
      !telefoneCelularValido(clienteForm.telefone)
    ) {
      setClienteModalErro(
        "Informe o nome e um celular válido com DDD e 11 dígitos.",
      );
      return;
    }

    setClienteModalErro("");
    setClienteEdicaoPendente({
      cliente: clienteEditando,
      dados: { ...clienteForm },
    });
  };

  const confirmarEdicaoCliente = async () => {
    if (!clienteEdicaoPendente?.cliente.id || clienteActionInFlight.current)
      return;

    try {
      clienteActionInFlight.current = true;
      setClienteModalSaving(true);
      const clienteAtualizado = await atualizarCliente(
        clienteEdicaoPendente.cliente.id,
        clienteEdicaoPendente.dados,
      );
      setClientes((current) =>
        atualizarClienteNaLista(
          current.filter(
            (cliente) => cliente.id !== clienteEdicaoPendente.cliente.id,
          ),
          clienteAtualizado,
        ),
      );
      if (clienteSelecionado?.id === clienteEdicaoPendente.cliente.id) {
        setClienteSelecionado(clienteAtualizado);
        setClienteBusca(clienteAtualizado.nome);
        setForm((current) => ({
          ...current,
          nomeCliente: clienteAtualizado.nome,
        }));
      }
      setClienteEdicaoPendente(null);
      setClienteEditando(null);
      setClienteModalErro("");
    } catch (error) {
      setClienteModalErro(
        error instanceof Error
          ? `Não foi possível editar o cliente: ${error.message}`
          : "Não foi possível editar o cliente. Tente novamente.",
      );
    } finally {
      clienteActionInFlight.current = false;
      setClienteModalSaving(false);
    }
  };

  const confirmarCadastroCliente = async () => {
    if (!clienteCadastroPendente || clienteActionInFlight.current) return;

    try {
      clienteActionInFlight.current = true;
      setClienteModalSaving(true);
      const clienteSalvo = await salvarCliente(clienteCadastroPendente);
      setClientes((current) => atualizarClienteNaLista(current, clienteSalvo));
      setClienteForm({ nome: "", telefone: "", observacoes: "" });
      setClienteCadastroPendente(null);
      setClienteBusca(clienteSalvo.nome);
      setClienteSelecionado({
        id: clienteSalvo.id,
        nome: clienteSalvo.nome,
        telefone: clienteSalvo.telefone,
        telefoneDigitos: clienteSalvo.telefoneDigitos,
        observacoes: clienteSalvo.observacoes,
      });
      setForm((current) => ({ ...current, nomeCliente: clienteSalvo.nome }));
      setClienteErro("");
    } catch (error) {
      setClienteModalErro(
        error instanceof Error
          ? `Não foi possível salvar o cliente: ${error.message}`
          : "Não foi possível salvar o cliente. Tente novamente.",
      );
    } finally {
      clienteActionInFlight.current = false;
      setClienteModalSaving(false);
    }
  };

  const handleExcluirCliente = async () => {
    if (!clienteExcluindo?.id || clienteActionInFlight.current) return;

    try {
      clienteActionInFlight.current = true;
      setClienteModalSaving(true);
      await excluirCliente(clienteExcluindo.id);
      setClientes((current) =>
        current.filter((cliente) => cliente.id !== clienteExcluindo.id),
      );
      if (clienteSelecionado?.id === clienteExcluindo.id) {
        setClienteSelecionado(null);
        setForm((current) => ({ ...current, nomeCliente: "" }));
      }
      setClienteExcluindo(null);
      setClienteModalErro("");
    } catch (error) {
      setClienteModalErro(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o cliente. Tente novamente.",
      );
    } finally {
      clienteActionInFlight.current = false;
      setClienteModalSaving(false);
    }
  };

  const handleClienteSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setClienteErro("");

    const nome = clienteForm.nome.trim();
    if (!nome) {
      setClienteErro("Informe o nome do cliente para salvar.");
      return;
    }

    if (!telefoneCelularValido(clienteForm.telefone)) {
      setClienteErro("Informe um celular válido com DDD e 11 dígitos.");
      return;
    }

    setClienteCadastroPendente({ ...clienteForm, nome });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErro("");

    if (!clientePronto) {
      setErro("Pesquise ou cadastre o cliente antes de registrar a compra.");
      return;
    }

    const itensValidos = form.itens
      .map((item) => ({
        descricao: item.descricao.trim(),
        quantidade: Math.max(1, Number(item.quantidade || 1)),
        valor: Number(item.valor || 0),
      }))
      .filter((item) => item.descricao);

    if (itensValidos.length === 0) {
      setErro("Adicione pelo menos uma peça vendida.");
      return;
    }

    if (
      itensValidos.some(
        (item) => !Number.isFinite(item.valor) || item.valor <= 0,
      )
    ) {
      setErro("Informe o valor de cada peça vendida.");
      return;
    }

    const valorTotalCompra = valorTotalCalculado;
    if (!Number.isFinite(valorTotalCompra) || valorTotalCompra <= 0) {
      setErro("O valor total da compra deve ser maior que zero.");
      return;
    }

    if (!form.dataVenda) {
      setErro("Informe a data da venda.");
      return;
    }

    const quantidadeParcelas = Number(form.quantidadeParcelas || 1);
    if (!Number.isInteger(quantidadeParcelas) || quantidadeParcelas < 1) {
      setErro("Informe uma quantidade de parcelas válida.");
      return;
    }

    setVendaPendente({
      nomeCliente: form.nomeCliente.trim(),
      ...(clienteSelecionado?.telefone ? { telefoneCliente: clienteSelecionado.telefone } : {}),
      ...(clienteSelecionado?.observacoes ? { observacoesCliente: clienteSelecionado.observacoes } : {}),
      produto: itensValidos[0].descricao,
      descricaoPeca: itensValidos[0].descricao,
      valor: valorTotalCompra,
      subtotalCompra,
      valorTotalCompra,
      aplicarDesconto: form.aplicarDesconto,
      percentualDesconto: form.aplicarDesconto ? percentualDesconto : 0,
      valorRecebido: 0,
      valorAindaPagar: valorTotalCompra,
      precoVenda: valorTotalCompra / itensValidos.reduce((sum, item) => sum + item.quantidade, 0),
      custoProducao: 0,
      quantidadeVendida: itensValidos.reduce((sum, item) => sum + item.quantidade, 0),
      quantidadePecas: itensValidos.reduce((sum, item) => sum + item.quantidade, 0),
      pecas: itensValidos.map((item) => item.descricao),
      itens: itensValidos.map(({ descricao, quantidade, valor }) => ({ descricao, quantidade, valor })),
      lucroCalculado: valorTotalCompra,
      formaPagamento: form.formaPagamento,
      quantidadeParcelas,
      ...(clienteSelecionado?.id ? { clienteId: clienteSelecionado.id } : {}),
      dataCompra: new Date(form.dataVenda),
      dataRecebimento: new Date(form.dataRecebimento || form.dataVenda),
    });
  };

  const confirmarRegistroVenda = () => {
    if (!vendaPendente) return;

    const vendaParaRegistrar = vendaPendente;
    // Fecha a confirmação imediatamente. A gravação pode aguardar a resposta
    // do Firestore mesmo depois de a compra já ter sido persistida.
    setVendaPendente(null);
    setForm({ ...initialForm, nomeCliente: vendaParaRegistrar.nomeCliente });
    setErro("");

    void onRegistrarVenda(vendaParaRegistrar).catch((error) => {
      console.error(error);
      setErro(error instanceof Error ? `Não foi possível registrar a compra: ${error.message}` : "Não foi possível registrar a compra. Tente novamente.");
    });
  };

  const handlePagamentoChange = (
    vendaId: string,
    valor: string,
    dataRecebimento: string,
  ) => {
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
    const dataRecebimento = entrada.dataRecebimento
      ? new Date(entrada.dataRecebimento)
      : undefined;

    try {
      await atualizarPagamentoVenda(venda.id, {
        valorRecebido,
        dataRecebimento,
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-stone-800">Nova venda</h3>
            {clienteSelecionado ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Cliente selecionado</span> : null}
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelClass}>Buscar cliente</label>
              <input
                type="text"
                value={clienteBusca}
                onChange={(event) =>
                  handleClienteBuscaChange(event.target.value)
                }
                className={inputClass}
                placeholder="Nome ou telefone"
              />
            </div>

            {clienteSelecionado ? (
              <div className="rounded-3xl border border-rose-200 bg-rose-50/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-rose-500">
                      Cliente da compra
                    </p>
                    <h4 className="mt-1 truncate text-base font-semibold text-stone-900">
                      {clienteSelecionado.nome}
                    </h4>
                    {clienteSelecionado.telefone ? (
                      <p className="mt-1 text-sm text-stone-600">
                        {clienteSelecionado.telefone}
                      </p>
                    ) : null}
                    {clienteSelecionado.observacoes ? (
                      <p className="mt-2 text-sm text-stone-500">
                        {clienteSelecionado.observacoes}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={trocarCliente}
                    className="shrink-0 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                  >
                    Trocar cliente
                  </button>
                </div>
              </div>
            ) : null}

            {!clienteSelecionado &&
            clienteBusca.trim() &&
            clientesFiltrados.length > 0 ? (
              <ul className="rounded-2xl border border-stone-100 bg-stone-50 p-2">
                {clientesFiltrados.map((cliente) => (
                  <li
                    key={cliente.id ?? cliente.telefoneDigitos ?? cliente.nome}
                  >
                    <div className="flex items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-white">
                      <button
                        type="button"
                        onClick={() => selecionarCliente(cliente)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block truncate text-sm font-semibold text-stone-800">
                          {cliente.nome}
                        </span>
                        {cliente.telefone ? (
                          <span className="mt-1 block text-xs text-stone-500">
                            {cliente.telefone}
                          </span>
                        ) : null}
                      </button>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => abrirEdicaoCliente(cliente)}
                          className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
                          aria-label={`Editar ${cliente.nome}`}
                          title="Editar cliente"
                        >
                          <PencilIcon />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setClienteModalErro("");
                            setClienteExcluindo(cliente);
                          }}
                          className="rounded-lg p-2 text-stone-500 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Excluir ${cliente.nome}`}
                          title="Excluir cliente"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            {!clienteSelecionado &&
            clienteBusca.trim() &&
            clientesFiltrados.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-500">
                Nenhum cliente encontrado. Cadastre um novo abaixo.
              </p>
            ) : null}

            {clienteErro ? (
              <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {clienteErro}
              </p>
            ) : null}

            {!clienteSelecionado ? (
              <details className="rounded-3xl border border-stone-100 bg-stone-50 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-stone-800">Cadastrar novo cliente</summary>
                <form
                  onSubmit={handleClienteSubmit}
                  className="mt-3 grid gap-3 md:grid-cols-2"
                >
                  <div className="md:col-span-2">
                    <label className={labelClass}>Nome</label>
                    <input
                      type="text"
                      value={clienteForm.nome}
                      onChange={(event) =>
                        setClienteForm((current) => ({
                          ...current,
                          nome: event.target.value,
                        }))
                      }
                      className={inputClass}
                      placeholder="Nome do cliente"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Telefone</label>
                    <input
                      type="tel"
                      value={clienteForm.telefone}
                      inputMode="numeric"
                      onChange={(event) =>
                        setClienteForm((current) => ({
                          ...current,
                          telefone: formatarTelefoneCliente(event.target.value),
                        }))
                      }
                      className={inputClass}
                      placeholder="(11) 9 9999-0000"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Observações</label>
                    <input
                      type="text"
                      value={clienteForm.observacoes}
                      onChange={(event) =>
                        setClienteForm((current) => ({
                          ...current,
                          observacoes: event.target.value,
                        }))
                      }
                      className={inputClass}
                      placeholder="Opcional"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={clienteModalSaving}
                    className="md:col-span-2 rounded-2xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
                  >
                    Salvar cliente
                  </button>
                </form>
              </details>
            ) : null}
          </div>

          {clienteSelecionado ? <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {erro ? (
              <p
                className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                role="alert"
              >
                {erro}
              </p>
            ) : null}

            <fieldset className="rounded-3xl border border-stone-100 bg-stone-50 p-4">
              <legend className="px-1 text-sm font-semibold text-stone-800">Itens da compra</legend>

              <div className="space-y-3">
                {form.itens.map((item, index) => (
                  <div
                    key={`item-${index}`}
                    className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_140px_auto]"
                  >
                    <div>
                      <label className={labelClass}>Peça / produto</label>
                      <input
                        type="text"
                        value={item.descricao}
                        onChange={(event) =>
                          atualizarItem(index, "descricao", event.target.value)
                        }
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
                        onChange={(event) =>
                          atualizarItem(index, "quantidade", event.target.value)
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Valor da peça</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.valor}
                        onChange={(event) =>
                          atualizarItem(index, "valor", event.target.value)
                        }
                        className={inputClass}
                        placeholder="0,00"
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
            </fieldset>

            <fieldset className="rounded-3xl border border-stone-100 bg-stone-50 p-4">
              <legend className="px-1 text-sm font-semibold text-stone-800">Pagamento</legend>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Subtotal das peças</label>
                  <input
                    type="number"
                    value={subtotalCompra.toFixed(2)}
                    className={inputClass}
                    readOnly
                  />
                </div>
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-700">
                    <input
                      type="checkbox"
                      checked={form.aplicarDesconto}
                      onChange={(event) =>
                        atualizarCampo("aplicarDesconto", event.target.checked)
                      }
                      className="h-4 w-4 rounded border-stone-300 accent-rose-500"
                    />
                    Aplicar desconto
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.percentualDesconto}
                    onChange={(event) =>
                      atualizarCampo("percentualDesconto", event.target.value)
                    }
                    className={inputClass}
                    placeholder="Percentual (%)"
                    disabled={!form.aplicarDesconto}
                  />
                </div>
                <div>
                  <label className={labelClass}>Valor total</label>
                  <input
                    type="number"
                    value={valorTotalCalculado.toFixed(2)}
                    className={`${inputClass} font-semibold text-stone-900`}
                    readOnly
                  />
                </div>
                <div>
                  <label className={labelClass}>Pagamento</label>
                  <select
                    value={form.formaPagamento}
                    onChange={(event) =>
                      atualizarCampo(
                        "formaPagamento",
                        event.target.value as FormaPagamento,
                      )
                    }
                    className={inputClass}
                  >
                    <option value="PIX">PIX</option>
                    <option value="Dinheiro">Dinheiro</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Quantidade de parcelas</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.quantidadeParcelas}
                    onChange={(event) => atualizarCampo("quantidadeParcelas", event.target.value)}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Data da venda</label>
                  <input
                    type="date"
                    value={form.dataVenda}
                    onChange={(event) =>
                      atualizarCampo("dataVenda", event.target.value)
                    }
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Data de recebimento</label>
                  <input
                    type="date"
                    value={form.dataRecebimento}
                    onChange={(event) =>
                      atualizarCampo("dataRecebimento", event.target.value)
                    }
                    className={inputClass}
                  />
                </div>
              </div>
            </fieldset>

            <button
              type="submit"
              disabled={!pagamentoPronto}
              className="w-full rounded-2xl bg-stone-900 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-stone-200 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
            >
              Revisar e registrar compra
            </button>
          </form> : null}
        </section>

        <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">
                Vendas
              </p>
              <h3 className="mt-1 text-lg font-semibold text-stone-800">
                Resumo das vendas
              </h3>
            </div>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
              {vendas.length} itens
            </span>
          </div>
          <SalesList
            vendas={vendas}
            pagamentos={pagamentos}
            onPagamentoChange={handlePagamentoChange}
            onSalvarPagamento={handleSalvarPagamento}
            expandedId={expandedId}
            onToggle={(id) =>
              setExpandedId((current) => (current === id ? null : id))
            }
          />
        </section>
      </div>

      {clienteEditando ? (
        <Modal title="Editar cliente" onClose={fecharEdicaoCliente}>
          <form onSubmit={handleEditarCliente} className="space-y-4">
            <ClienteFields
              clienteForm={clienteForm}
              setClienteForm={setClienteForm}
            />
            {clienteModalErro ? (
              <p
                className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                role="alert"
              >
                {clienteModalErro}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={fecharEdicaoCliente}
                className="rounded-2xl border border-stone-200 px-4 py-3 text-sm font-semibold text-stone-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={clienteModalSaving}
                className="rounded-2xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white disabled:bg-stone-400"
              >
                {clienteModalSaving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {clienteExcluindo ? (
        <Modal
          title="Excluir cliente"
          onClose={() => !clienteModalSaving && setClienteExcluindo(null)}
        >
          <p className="text-sm leading-6 text-stone-600">
            Tem certeza que deseja excluir{" "}
            <strong className="text-stone-900">{clienteExcluindo.nome}</strong>?
            Esta ação não poderá ser desfeita.
          </p>
          {clienteModalErro ? (
            <p
              className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              role="alert"
            >
              {clienteModalErro}
            </p>
          ) : null}
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setClienteExcluindo(null)}
              disabled={clienteModalSaving}
              className="rounded-2xl border border-stone-200 px-4 py-3 text-sm font-semibold text-stone-600"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleExcluirCliente}
              disabled={clienteModalSaving}
              className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:bg-red-300"
            >
              {clienteModalSaving ? "Excluindo..." : "Excluir cliente"}
            </button>
          </div>
        </Modal>
      ) : null}

      {clienteCadastroPendente ? (
        <Modal
          title="Confirmar cadastro"
          onClose={() =>
            !clienteModalSaving && setClienteCadastroPendente(null)
          }
        >
          <p className="text-sm leading-6 text-stone-600">
            Confirma o cadastro de{" "}
            <strong className="text-stone-900">
              {clienteCadastroPendente.nome}
            </strong>
            ?
          </p>
          {clienteModalErro ? (
            <p
              className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              role="alert"
            >
              {clienteModalErro}
            </p>
          ) : null}
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setClienteCadastroPendente(null)}
              disabled={clienteModalSaving}
              className="rounded-2xl border border-stone-200 px-4 py-3 text-sm font-semibold text-stone-600"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmarCadastroCliente}
              disabled={clienteModalSaving}
              className="rounded-2xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white disabled:bg-stone-400"
            >
              Confirmar cadastro
            </button>
          </div>
        </Modal>
      ) : null}

      {clienteEdicaoPendente ? (
        <Modal
          title="Confirmar alterações"
          onClose={() => !clienteModalSaving && setClienteEdicaoPendente(null)}
        >
          <p className="text-sm leading-6 text-stone-600">
            Confirma as alterações do cliente{" "}
            <strong className="text-stone-900">
              {clienteEdicaoPendente.dados.nome}
            </strong>
            ?
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setClienteEdicaoPendente(null)}
              disabled={clienteModalSaving}
              className="rounded-2xl border border-stone-200 px-4 py-3 text-sm font-semibold text-stone-600"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmarEdicaoCliente}
              disabled={clienteModalSaving}
              className="rounded-2xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white disabled:bg-stone-400"
            >
              Confirmar alterações
            </button>
          </div>
        </Modal>
      ) : null}

      {vendaPendente ? (
        <Modal title="Confirmar nova compra" onClose={() => setVendaPendente(null)}>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <div className="rounded-2xl bg-stone-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">Cliente</p>
              <p className="mt-1 font-semibold text-stone-900">{vendaPendente.nomeCliente}</p>
              {vendaPendente.telefoneCliente ? <p className="mt-1 text-sm text-stone-600">{vendaPendente.telefoneCliente}</p> : null}
              {vendaPendente.observacoesCliente ? <p className="mt-1 text-sm text-stone-500">{vendaPendente.observacoesCliente}</p> : null}
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">Peças da compra</p>
              <ul className="mt-2 space-y-2">
                {(vendaPendente.itens ?? []).map((item, index) => (
                  <li key={`${item.descricao}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-stone-100 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-stone-700">{item.descricao} · qtd. {item.quantidade}</span>
                    <span className="shrink-0 font-semibold text-stone-900">{formatarMoeda(Number(item.valor ?? 0) * item.quantidade)}</span>
                  </li>
                ))}
              </ul>
            </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-stone-50 p-3"><span className="block text-xs text-stone-500">Subtotal</span><strong className="text-stone-900">{formatarMoeda(subtotalCompra)}</strong></div>
              <div className="rounded-2xl bg-rose-50 p-3"><span className="block text-xs text-stone-500">Desconto</span><strong className="text-stone-900">{Number(vendaPendente.valorTotalCompra ?? 0) < subtotalCompra ? `${percentualDesconto}%` : "Não aplicado"}</strong></div>
            </div>

            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-stone-700">
              <div className="flex items-center justify-between gap-3"><span>Valor total</span><strong className="text-lg text-stone-900">{formatarMoeda(Number(vendaPendente.valorTotalCompra ?? 0))}</strong></div>
              <div className="mt-2 flex items-center justify-between gap-3"><span>Pagamento</span><strong className="text-stone-900">{vendaPendente.formaPagamento} · {vendaPendente.quantidadeParcelas}x</strong></div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm text-stone-600">
              <p><span className="block text-xs text-stone-400">Data da venda</span>{formatarDataLegivel(formatarDataInput(vendaPendente.dataCompra))}</p>
              <p><span className="block text-xs text-stone-400">Recebimento</span>{formatarDataLegivel(formatarDataInput(vendaPendente.dataRecebimento))}</p>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => setVendaPendente(null)} className="rounded-2xl border border-stone-200 px-4 py-3 text-sm font-semibold text-stone-600">Revisar</button>
            <button type="button" onClick={confirmarRegistroVenda} className="rounded-2xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white">Confirmar compra</button>
          </div>
        </Modal>
      ) : null}

      {clienteModalSaving ? <LoadingModal /> : null}
    </div>
  );
}

function ClienteFields({
  clienteForm,
  setClienteForm,
}: {
  clienteForm: { nome: string; telefone: string; observacoes: string };
  setClienteForm: Dispatch<
    SetStateAction<{ nome: string; telefone: string; observacoes: string }>
  >;
}) {
  return (
    <>
      <div>
        <label className={labelClass}>Nome</label>
        <input
          type="text"
          value={clienteForm.nome}
          onChange={(event) =>
            setClienteForm((current) => ({
              ...current,
              nome: event.target.value,
            }))
          }
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Telefone</label>
        <input
          type="tel"
          inputMode="numeric"
          value={clienteForm.telefone}
          onChange={(event) =>
            setClienteForm((current) => ({
              ...current,
              telefone: formatarTelefoneCliente(event.target.value),
            }))
          }
          className={inputClass}
          placeholder="(11) 9 9999-0000"
        />
      </div>
      <div>
        <label className={labelClass}>Observações</label>
        <input
          type="text"
          value={clienteForm.observacoes}
          onChange={(event) =>
            setClienteForm((current) => ({
              ...current,
              observacoes: event.target.value,
            }))
          }
          className={inputClass}
        />
      </div>
    </>
  );
}

function LoadingModal() {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/45 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-label="Processando"
    >
      <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-stone-800 shadow-2xl">
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-stone-200 border-t-stone-900"
          aria-hidden="true"
        />
        Processando, aguarde...
      </div>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cliente-modal-title"
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h3
            id="cliente-modal-title"
            className="text-lg font-semibold text-stone-900"
          >
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-xl leading-none text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth="1.8"
    >
      <path d="m4 16.5-.8 3.8 3.8-.8L18.5 8a2.7 2.7 0 0 0-3.8-3.8L4 16.5Z" />
      <path d="m13.5 5.5 5 5" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth="1.8"
    >
      <path d="M4 7h16M10 11v6m4-6v6M9 7V4h6v3m-9 0 1 13h8l1-13" />
    </svg>
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
  pagamentos: Record<
    string,
    { valorRecebido: string; dataRecebimento: string }
  >;
  onPagamentoChange: (
    id: string,
    valor: string,
    dataRecebimento: string,
  ) => void;
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
        const subtotal = Number(venda.subtotalCompra ?? venda.itens?.reduce((total, item) => total + Number(item.valor ?? 0) * item.quantidade, 0) ?? valorTotal);
        const percentualDesconto = Number(venda.percentualDesconto ?? 0);
        const valorRecebidoAtual = Number(
          pagamentos[venda.id ?? ""]?.valorRecebido ?? venda.valorRecebido ?? 0,
        );
        const restante = Math.max(0, valorTotal - valorRecebidoAtual);
        const expandido = expandedId === venda.id;

        return (
          <li
            key={venda.id ?? `${venda.nomeCliente}-${venda.descricaoPeca}`}
            className="rounded-[22px] border border-stone-100 bg-white p-4 shadow-sm"
          >
            <button
              type="button"
              onClick={() => venda.id && onToggle(venda.id)}
              className="flex w-full items-start justify-between gap-3 text-left"
            >
              <div>
                <span className="block text-sm font-semibold text-stone-800">
                  {venda.nomeCliente}
                </span>
                <span className="mt-1 block text-sm text-stone-500">
                  {formatarMoeda(restante)} ainda a pagar
                </span>
                <span className="mt-1 block text-xs text-stone-500">
                  Subtotal: {formatarMoeda(subtotal)}{percentualDesconto > 0 ? ` · desconto de ${percentualDesconto}%` : ""}
                </span>
                <span className="mt-1 inline-flex rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                  {venda.quantidadeParcelas ?? 1}x · {venda.formaPagamento}
                </span>
              </div>
              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-600">
                {expandido ? "Fechar" : "Abrir"}
              </span>
            </button>

            {expandido ? (
              <div className="mt-4 space-y-4 border-t border-stone-100 pt-4">
                <div className="grid gap-2 text-sm sm:grid-cols-3">
                  <div className="rounded-2xl bg-stone-50 px-3 py-2"><span className="block text-xs text-stone-500">Subtotal</span><strong className="text-stone-900">{formatarMoeda(subtotal)}</strong></div>
                  <div className="rounded-2xl bg-rose-50 px-3 py-2"><span className="block text-xs text-stone-500">Desconto</span><strong className="text-stone-900">{percentualDesconto > 0 ? `${percentualDesconto}%` : "Não aplicado"}</strong></div>
                  <div className="rounded-2xl bg-stone-50 px-3 py-2"><span className="block text-xs text-stone-500">Total</span><strong className="text-stone-900">{formatarMoeda(valorTotal)}</strong></div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">
                    Peças vendidas
                  </p>
                  <ul className="mt-2 space-y-2">
                    {(venda.itens && venda.itens.length > 0
                      ? venda.itens
                      : [
                          {
                            descricao: venda.descricaoPeca,
                            quantidade: venda.quantidadePecas ?? 1,
                          },
                        ]
                    ).map((item, index) => (
                      <li
                        key={`${venda.id ?? "venda"}-${index}`}
                        className="rounded-2xl bg-stone-50 px-3 py-2 text-sm text-stone-600"
                      >
                        {item.descricao} · qtd. {item.quantidade}{item.valor != null ? ` · ${formatarMoeda(item.valor)} cada` : ""}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                      Data de recebimento
                    </label>
                    <input
                      type="date"
                      value={
                        pagamentos[venda.id ?? ""]?.dataRecebimento ??
                        formatarDataInput(venda.dataRecebimento)
                      }
                      onChange={(event) =>
                        venda.id &&
                        onPagamentoChange(
                          venda.id,
                          pagamentos[venda.id ?? ""]?.valorRecebido ??
                            String(venda.valorRecebido ?? 0),
                          event.target.value,
                        )
                      }
                      className="block w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                      Valor recebido
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        pagamentos[venda.id ?? ""]?.valorRecebido ??
                        String(venda.valorRecebido ?? 0)
                      }
                      onChange={(event) =>
                        venda.id &&
                        onPagamentoChange(
                          venda.id,
                          event.target.value,
                          pagamentos[venda.id ?? ""]?.dataRecebimento ??
                            formatarDataInput(venda.dataRecebimento),
                        )
                      }
                      className="block w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-stone-700">
                  Valor restante:{" "}
                  <strong className="text-stone-900">
                    {formatarMoeda(restante)}
                  </strong>
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
