import { type DadosAnaliseFinanceira, type ProdutoAnaliseFinanceira, type Venda } from '../types';

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const percentFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizarTexto = (value: string) => value.trim().toLowerCase();

export const formatarMoeda = (value: number) => brlFormatter.format(toNumber(value));

export const formatarPercentual = (value: number) => `${percentFormatter.format(toNumber(value))}%`;

export const calcularLucro = (precoVenda: number, custoProducao: number, quantidadeVendida: number) => {
  return (precoVenda - custoProducao) * quantidadeVendida;
};

export const calcularMargem = (receitaTotal: number, lucroCalculado: number) => {
  if (receitaTotal <= 0) return 0;
  return (lucroCalculado / receitaTotal) * 100;
};

export const formatarDataVenda = (data: Venda['dataRecebimento']) => {
  const dataConvertida = data instanceof Date ? data : data.toDate();
  return dataConvertida.toLocaleDateString('pt-BR');
};

export const normalizarVendasParaAnalise = (vendas: Venda[]): DadosAnaliseFinanceira => {
  const produtosMap = new Map<string, ProdutoAnaliseFinanceira>();

  vendas.forEach((venda) => {
    const produto = venda.produto?.trim() || venda.descricaoPeca?.trim() || 'Produto sem nome';
    const key = normalizarTexto(produto);
    const quantidadeVendida = Math.max(1, toNumber(venda.quantidadeVendida, 1));
    // Vendas antigas não possuem todos os campos financeiros; por isso os valores são normalizados com fallback seguro.
    const precoVenda = Math.max(0, toNumber(venda.precoVenda ?? venda.valor));
    const custoProducao = Math.max(0, toNumber(venda.custoProducao));
    const receitaTotal = precoVenda * quantidadeVendida;
    const custoTotal = custoProducao * quantidadeVendida;
    const lucroVenda =
      typeof venda.lucroCalculado === 'number' && Number.isFinite(venda.lucroCalculado)
        ? venda.lucroCalculado
        : calcularLucro(precoVenda, custoProducao, quantidadeVendida);

    const existente = produtosMap.get(key);

    if (!existente) {
      produtosMap.set(key, {
        produto,
        descricoes: [venda.descricaoPeca].filter(Boolean),
        ingredientes: venda.ingredientes ?? [],
        custoProducao,
        precoVenda,
        quantidadeVendida,
        receitaTotal,
        custoTotal,
        lucroCalculado: lucroVenda,
        margemAtual: calcularMargem(receitaTotal, lucroVenda),
      });
      return;
    }

    const ingredientes = new Set([...existente.ingredientes, ...(venda.ingredientes ?? [])]);
    const descricoes = new Set([...existente.descricoes, venda.descricaoPeca].filter(Boolean));
    const novaQuantidade = existente.quantidadeVendida + quantidadeVendida;
    const novaReceita = existente.receitaTotal + receitaTotal;
    const novoCusto = existente.custoTotal + custoTotal;
    const novoLucro = existente.lucroCalculado + lucroVenda;

    produtosMap.set(key, {
      ...existente,
      descricoes: [...descricoes],
      ingredientes: [...ingredientes],
      quantidadeVendida: novaQuantidade,
      receitaTotal: novaReceita,
      custoTotal: novoCusto,
      lucroCalculado: novoLucro,
      precoVenda: novaQuantidade > 0 ? novaReceita / novaQuantidade : 0,
      custoProducao: novaQuantidade > 0 ? novoCusto / novaQuantidade : 0,
      margemAtual: calcularMargem(novaReceita, novoLucro),
    });
  });

  const produtos = [...produtosMap.values()].sort((a, b) => b.lucroCalculado - a.lucroCalculado);
  const receitaTotal = produtos.reduce((total, produto) => total + produto.receitaTotal, 0);
  const custoTotal = produtos.reduce((total, produto) => total + produto.custoTotal, 0);
  const lucroTotal = produtos.reduce((total, produto) => total + produto.lucroCalculado, 0);
  const totalItensVendidos = produtos.reduce((total, produto) => total + produto.quantidadeVendida, 0);

  return {
    produtos,
    resumo: {
      totalProdutos: produtos.length,
      totalItensVendidos,
      receitaTotal,
      custoTotal,
      lucroTotal,
      margemMedia: calcularMargem(receitaTotal, lucroTotal),
      produtosSemCusto: produtos.filter((produto) => produto.custoTotal === 0).map((produto) => produto.produto),
    },
  };
};
