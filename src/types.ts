export type FormaPagamento = 'PIX' | 'Dinheiro';

export type DataCompat = Date | { toDate: () => Date };

export interface Cliente {
  id?: string;
  nome: string;
  telefone?: string;
  telefoneDigitos?: string;
  observacoes?: string;
  criadoEm?: DataCompat;
  atualizadoEm?: DataCompat;
}

export interface Venda {
  id?: string;
  nomeCliente: string;
  clienteId?: string;
  telefoneCliente?: string;
  observacoesCliente?: string;
  produto?: string;
  descricaoPeca: string;
  valor: number;
  subtotalCompra?: number;
  valorTotalCompra?: number;
  aplicarDesconto?: boolean;
  percentualDesconto?: number;
  valorRecebido?: number;
  valorAindaPagar?: number;
  precoVenda?: number;
  custoProducao?: number;
  ingredientes?: string[];
  quantidadeVendida?: number;
  quantidadePecas?: number;
  pecas?: string[];
  itens?: Array<{ descricao: string; quantidade: number; valor?: number }>;
  lucroCalculado?: number;
  formaPagamento: FormaPagamento;
  quantidadeParcelas: number;
  dataCompra?: DataCompat;
  dataRecebimento: DataCompat;
  dataRegistro?: DataCompat;
}

export interface ProdutoAnaliseFinanceira {
  produto: string;
  descricoes: string[];
  ingredientes: string[];
  custoProducao: number;
  precoVenda: number;
  quantidadeVendida: number;
  receitaTotal: number;
  custoTotal: number;
  lucroCalculado: number;
  margemAtual: number;
}

export interface ResumoAnaliseFinanceira {
  totalProdutos: number;
  totalItensVendidos: number;
  receitaTotal: number;
  custoTotal: number;
  lucroTotal: number;
  margemMedia: number;
  produtosSemCusto: string[];
}

export interface DadosAnaliseFinanceira {
  produtos: ProdutoAnaliseFinanceira[];
  resumo: ResumoAnaliseFinanceira;
}

export interface ResultadoAssistenteIA {
  resultado: string;
  sugestoes: string[];
  relatorio: string;
  origem: 'ia' | 'demonstracao';
  provider?: 'openai' | 'gemini' | 'backend' | 'local';
  modelo?: string;
  avisos?: string[];
  geradoEm: string;
}
