import { useMemo, useState, type FormEvent } from 'react';
import { calcularLucro, formatarDataVenda, formatarMoeda, } from '../AI/finance';
import { type FormaPagamento, type Venda } from '../types';

interface SalesPanelProps {
  vendas: Venda[];
  onRegistrarVenda: (venda: Omit<Venda, 'id' | 'dataRegistro'>) => Promise<void>;
}

interface FormState {
  nomeCliente: string;
  produto: string;
  descricaoPeca: string;
  precoVenda: string;
  custoProducao: string;
  quantidadeVendida: string;
  ingredientes: string;
  formaPagamento: FormaPagamento;
  quantidadeParcelas: number;
  dataRecebimento: string;
}

const initialForm: FormState = {
  nomeCliente: '',
  produto: '',
  descricaoPeca: '',
  precoVenda: '',
  custoProducao: '',
  quantidadeVendida: '1',
  ingredientes: '',
  formaPagamento: 'PIX',
  quantidadeParcelas: 1,
  dataRecebimento: '',
};

const labelClass = 'block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5';
const inputClass =
  'block w-full rounded-xl border border-stone-200 bg-stone-50 p-3 text-stone-700 outline-none transition-all focus:border-rose-300 focus:bg-white focus:ring focus:ring-rose-200 focus:ring-opacity-50';

export function SalesPanel({ vendas, onRegistrarVenda }: SalesPanelProps) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');

  const lucroPreview = useMemo(() => {
    const precoVenda = Number(form.precoVenda);
    const custoProducao = Number(form.custoProducao);
    const quantidadeVendida = Math.max(1, Number(form.quantidadeVendida));

    if (!Number.isFinite(precoVenda) || !Number.isFinite(custoProducao)) return 0;

    return calcularLucro(precoVenda, custoProducao, quantidadeVendida);
  }, [form.custoProducao, form.precoVenda, form.quantidadeVendida]);

  const atualizarCampo = (campo: keyof FormState, valor: string | number) => {
    setForm((current) => ({ ...current, [campo]: valor }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErro('');

    const precoVenda = Number(form.precoVenda);
    const custoProducao = Number(form.custoProducao);
    const quantidadeVendida = Math.max(1, Number(form.quantidadeVendida));

    if (!form.nomeCliente || !form.produto || !form.descricaoPeca || !form.dataRecebimento) return;

    if (!Number.isFinite(precoVenda) || !Number.isFinite(custoProducao) || !Number.isFinite(quantidadeVendida)) {
      setErro('Revise os valores financeiros antes de registrar a venda.');
      return;
    }

    try {
      setSaving(true);
      await onRegistrarVenda({
        nomeCliente: form.nomeCliente.trim(),
        produto: form.produto.trim(),
        descricaoPeca: form.descricaoPeca.trim(),
        valor: precoVenda,
        precoVenda,
        custoProducao,
        quantidadeVendida,
        ingredientes: form.ingredientes
          .split(/[,;\n]/)
          .map((ingrediente) => ingrediente.trim())
          .filter(Boolean),
        lucroCalculado: calcularLucro(precoVenda, custoProducao, quantidadeVendida),
        formaPagamento: form.formaPagamento,
        quantidadeParcelas: form.quantidadeParcelas,
        dataRecebimento: new Date(form.dataRecebimento),
      });
      setForm(initialForm);
    } catch (error) {
      console.error(error);
      setErro('Não foi possível registrar a venda. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
      <section>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {erro && (
            <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
              {erro}
            </p>
          )}

          <div>
            <label className={labelClass}>Nome da Cliente</label>
            <input
              type="text"
              value={form.nomeCliente}
              onChange={(event) => atualizarCampo('nomeCliente', event.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Produto</label>
              <input
                type="text"
                value={form.produto}
                onChange={(event) => atualizarCampo('produto', event.target.value)}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className={labelClass}>Descrição da Peça</label>
              <input
                type="text"
                value={form.descricaoPeca}
                onChange={(event) => atualizarCampo('descricaoPeca', event.target.value)}
                className={inputClass}
                required
              />
            </div>
          </div>


          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Quantidade vendida</label>
              <input
                type="number"
                min="1"
                value={form.quantidadeVendida}
                onChange={(event) => atualizarCampo('quantidadeVendida', event.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Preço de Venda (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.precoVenda}
                onChange={(event) => atualizarCampo('precoVenda', event.target.value)}
                className={inputClass}
                required
              />
            </div>

          </div>

          <div className="grid gap-5 sm:grid-cols-2">
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
              <label className={labelClass}>Parcelas</label>
              <input
                type="number"
                min="1"
                value={form.quantidadeParcelas}
                onChange={(event) => atualizarCampo('quantidadeParcelas', Number(event.target.value))}
                className={inputClass}
                required
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Data da Venda</label>
            <input
              type="date"
              value={form.dataRecebimento}
              onChange={(event) => atualizarCampo('dataRecebimento', event.target.value)}
              className={inputClass}
              required
            />
          </div>

          <div className="rounded-2xl border border-stone-100 bg-stone-50 px-4 py-3 text-sm text-stone-600">
            Lucro calculado: <strong className="text-stone-900">{formatarMoeda(lucroPreview)}</strong>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-1 w-full rounded-xl bg-stone-900 px-4 py-3.5 font-medium text-white shadow-lg shadow-stone-200 transition-all hover:bg-stone-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-stone-400"
          >
            {saving ? 'Registrando...' : 'Registrar Venda'}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-5 border-b border-stone-100 pb-3 text-xl font-light text-stone-800">Registro de Vendas</h2>
        <SalesList vendas={vendas} />
      </section>
    </div>
  );
}

function SalesList({ vendas }: { vendas: Venda[] }) {
  if (vendas.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-6 text-center text-sm text-stone-500">
        Nenhuma venda registrada.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {vendas.map((venda) => (
        <SalesCard key={venda.id ?? `${venda.nomeCliente}-${venda.descricaoPeca}`} venda={venda} />
      ))}
    </ul>
  );
}

function SalesCard({ venda }: { venda: Venda }) {
  
  return (
    <li className="relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-l-4 border-stone-100 border-l-rose-300 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="block font-semibold text-stone-800">{venda.produto ?? venda.descricaoPeca}</span>
          <span className="mt-1 block text-sm italic text-stone-500">{venda.nomeCliente}</span>
        </div>
      </div>

      <p className="text-sm text-stone-500">{venda.descricaoPeca}</p>

      {venda.ingredientes && venda.ingredientes.length > 0 && (
        <p className="text-xs text-stone-400">Ingredientes: {venda.ingredientes.join(', ')}</p>
      )}

      <div className="flex justify-between border-t border-stone-50 pt-2 text-[11px] font-medium uppercase tracking-wider text-stone-400">
        <span>
          {venda.formaPagamento} {venda.quantidadeParcelas > 1 ? `(${venda.quantidadeParcelas}x)` : ''}
        </span>
        <span>Recebimento: {formatarDataVenda(venda.dataRecebimento)}</span>
      </div>
    </li>
  );
}
