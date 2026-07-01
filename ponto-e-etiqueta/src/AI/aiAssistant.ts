import { calcularMargem, formatarMoeda, formatarPercentual } from './finance';
import {
  type DadosAnaliseFinanceira,
  type ProdutoAnaliseFinanceira,
  type ResultadoAssistenteIA,
} from '../types';

interface PromptsAssistente {
  sugestaoPreco: string;
  relatorioInteligente: string;
}

interface JsonRecord {
  [key: string]: unknown;
}

const margemMinimaSaudavel = 35;
const margemOportunidade = 45;

export const gerarPromptSugestaoPreco = (dados: DadosAnaliseFinanceira) => `
Você é uma consultora financeira especializada em confeitarias artesanais.
Analise os produtos cadastrados considerando custo total, margem atual e preço de venda informado.

Gere recomendações com:
- preço sugerido por produto;
- margem estimada;
- risco de subprecificação;
- oportunidade de aumento de lucro.

Dados dos produtos:
${JSON.stringify(dados.produtos, null, 2)}
`.trim();

export const gerarPromptRelatorioInteligente = (dados: DadosAnaliseFinanceira) => `
Você é uma assistente de IA para gestão financeira de uma confeitaria.
Crie um resumo financeiro em linguagem natural contendo:
- produto mais lucrativo;
- produto menos lucrativo;
- possíveis desperdícios;
- oportunidades de melhoria;
- recomendações de gestão.

Resumo financeiro:
${JSON.stringify(dados.resumo, null, 2)}

Produtos:
${JSON.stringify(dados.produtos, null, 2)}
`.trim();

export const analisarDadosFinanceirosComIA = async (
  dados: DadosAnaliseFinanceira,
): Promise<ResultadoAssistenteIA> => {
  if (dados.produtos.length === 0) {
    throw new Error('Cadastre ao menos uma venda com produto e preço de venda antes de analisar com IA.');
  }

  const prompts = {
    sugestaoPreco: gerarPromptSugestaoPreco(dados),
    relatorioInteligente: gerarPromptRelatorioInteligente(dados),
  };

  const respostaIA = await chamarIAConfigurada(dados, prompts);

  if (respostaIA) {
    return respostaIA;
  }

  return gerarAnaliseDemonstrativa(dados);
};

const chamarIAConfigurada = async (
  dados: DadosAnaliseFinanceira,
  prompts: PromptsAssistente,
): Promise<ResultadoAssistenteIA | null> => {
  const endpoint = import.meta.env.VITE_AI_ASSISTANT_ENDPOINT as string | undefined;
  const provider = ((import.meta.env.VITE_AI_PROVIDER as string | undefined) ?? '').toLowerCase();

  // Em produção, o endpoint backend é a opção mais segura porque evita expor chaves de IA no bundle do navegador.
  if (endpoint) {
    return chamarBackendSeguro(endpoint, dados, prompts);
  }

  if (provider === 'openai' && import.meta.env.VITE_OPENAI_API_KEY) {
    return chamarOpenAI(prompts);
  }

  if (provider === 'gemini' && import.meta.env.VITE_GEMINI_API_KEY) {
    return chamarGemini(prompts);
  }

  return null;
};

const chamarBackendSeguro = async (
  endpoint: string,
  dados: DadosAnaliseFinanceira,
  prompts: PromptsAssistente,
): Promise<ResultadoAssistenteIA> => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dados, prompts }),
  });

  if (!response.ok) {
    throw new Error('A integração com IA não respondeu corretamente.');
  }

  return normalizarRespostaIA(await response.json(), 'backend', 'ia');
};

const chamarOpenAI = async (prompts: PromptsAssistente): Promise<ResultadoAssistenteIA> => {
  const modelo = (import.meta.env.VITE_OPENAI_MODEL as string | undefined) ?? 'gpt-4.1-mini';
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: modelo,
      input: montarPromptFinal(prompts),
    }),
  });

  if (!response.ok) {
    throw new Error('Não foi possível concluir a análise com OpenAI.');
  }

  const body = await response.json();
  return normalizarRespostaIA(extrairTextoOpenAI(body), 'openai', modelo);
};

const chamarGemini = async (prompts: PromptsAssistente): Promise<ResultadoAssistenteIA> => {
  const modelo = (import.meta.env.VITE_GEMINI_MODEL as string | undefined) ?? 'gemini-1.5-flash';
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: montarPromptFinal(prompts) }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    },
  );

  if (!response.ok) {
    throw new Error('Não foi possível concluir a análise com Gemini.');
  }

  const body = await response.json();
  return normalizarRespostaIA(extrairTextoGemini(body), 'gemini', modelo);
};

const montarPromptFinal = (prompts: PromptsAssistente) => `
${prompts.sugestaoPreco}

${prompts.relatorioInteligente}

Responda apenas em JSON válido com este formato:
{
  "resultado": "síntese curta da análise",
  "sugestoes": ["recomendação objetiva 1", "recomendação objetiva 2"],
  "relatorio": "relatório financeiro em linguagem natural",
  "avisos": ["alertas de dados incompletos, se houver"]
}
`.trim();

const normalizarRespostaIA = (
  raw: unknown,
  provider: ResultadoAssistenteIA['provider'],
  modelo?: string,
): ResultadoAssistenteIA => {
  const parsed = parseJsonRecord(raw);

  return {
    resultado: textoSeguro(parsed.resultado, 'Análise financeira concluída.'),
    sugestoes: listaTextoSeguro(parsed.sugestoes),
    relatorio: textoSeguro(parsed.relatorio, typeof raw === 'string' ? raw : 'Relatório gerado pela IA.'),
    origem: 'ia',
    provider,
    modelo,
    avisos: listaTextoSeguro(parsed.avisos),
    geradoEm: new Date().toISOString(),
  };
};

const parseJsonRecord = (raw: unknown): JsonRecord => {
  if (isJsonRecord(raw)) return raw;

  if (typeof raw !== 'string') return {};

  try {
    const parsed = JSON.parse(raw);
    return isJsonRecord(parsed) ? parsed : {};
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');

    if (start < 0 || end <= start) {
      return { relatorio: raw };
    }

    try {
      const parsed = JSON.parse(raw.slice(start, end + 1));
      return isJsonRecord(parsed) ? parsed : { relatorio: raw };
    } catch {
      return { relatorio: raw };
    }
  }
};

const isJsonRecord = (value: unknown): value is JsonRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const textoSeguro = (value: unknown, fallback: string) => {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
};

const listaTextoSeguro = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
};

const extrairTextoOpenAI = (body: unknown) => {
  if (!isJsonRecord(body)) return '';

  if (typeof body.output_text === 'string') {
    return body.output_text;
  }

  if (!Array.isArray(body.output)) return '';

  return body.output
    .flatMap((item) => (isJsonRecord(item) && Array.isArray(item.content) ? item.content : []))
    .map((content) => (isJsonRecord(content) && typeof content.text === 'string' ? content.text : ''))
    .join('\n')
    .trim();
};

const extrairTextoGemini = (body: unknown) => {
  if (!isJsonRecord(body) || !Array.isArray(body.candidates)) return '';

  return body.candidates
    .flatMap((candidate) => {
      if (!isJsonRecord(candidate) || !isJsonRecord(candidate.content) || !Array.isArray(candidate.content.parts)) {
        return [];
      }

      return candidate.content.parts;
    })
    .map((part) => (isJsonRecord(part) && typeof part.text === 'string' ? part.text : ''))
    .join('\n')
    .trim();
};

const gerarAnaliseDemonstrativa = (dados: DadosAnaliseFinanceira): ResultadoAssistenteIA => {
  const produtos = [...dados.produtos].sort((a, b) => b.lucroCalculado - a.lucroCalculado);
  const produtoMaisLucrativo = produtos[0];
  const produtoMenosLucrativo = produtos[produtos.length - 1];
  const produtosComRisco = produtos.filter((produto) => produto.custoTotal > 0 && produto.margemAtual < 25);
  const ingredientesFrequentes = listarIngredientesFrequentes(produtos);

  return {
    resultado: `Foram analisados ${dados.resumo.totalProdutos} produto(s), com receita total de ${formatarMoeda(
      dados.resumo.receitaTotal,
    )}, lucro calculado de ${formatarMoeda(dados.resumo.lucroTotal)} e margem média de ${formatarPercentual(
      dados.resumo.margemMedia,
    )}.`,
    sugestoes: gerarSugestoesLocais(produtos),
    relatorio: gerarRelatorioLocal(
      produtoMaisLucrativo,
      produtoMenosLucrativo,
      produtosComRisco,
      ingredientesFrequentes,
      dados.resumo.produtosSemCusto,
    ),
    origem: 'demonstracao',
    provider: 'local',
    modelo: 'analise-local',
    avisos:
      dados.resumo.produtosSemCusto.length > 0
        ? [`${dados.resumo.produtosSemCusto.length} produto(s) precisam de custo de produção para uma análise completa.`]
        : [],
    geradoEm: new Date().toISOString(),
  };
};

const gerarSugestoesLocais = (produtos: ProdutoAnaliseFinanceira[]) => {
  return produtos.slice(0, 5).map((produto) => {
    if (produto.custoProducao <= 0) {
      return `${produto.produto}: cadastre o custo de produção para calcular margem real, risco de subprecificação e preço sugerido.`;
    }

    const precoMinimo = produto.custoProducao / (1 - margemMinimaSaudavel / 100);
    const precoOportunidade = produto.custoProducao / (1 - margemOportunidade / 100);
    const margemEstimada = calcularMargem(precoMinimo, precoMinimo - produto.custoProducao);
    const risco =
      produto.margemAtual < 25
        ? 'há risco de subprecificação e perda de potencial de lucro'
        : 'a margem atual está em uma faixa administrável';

    return `${produto.produto}: custo médio ${formatarMoeda(produto.custoProducao)}, preço atual ${formatarMoeda(
      produto.precoVenda,
    )}. Recomenda-se preço entre ${formatarMoeda(precoMinimo)} e ${formatarMoeda(
      precoOportunidade,
    )}, com margem estimada a partir de ${formatarPercentual(margemEstimada)}. ${risco}.`;
  });
};

const gerarRelatorioLocal = (
  produtoMaisLucrativo: ProdutoAnaliseFinanceira,
  produtoMenosLucrativo: ProdutoAnaliseFinanceira,
  produtosComRisco: ProdutoAnaliseFinanceira[],
  ingredientesFrequentes: string[],
  produtosSemCusto: string[],
) => {
  const risco =
    produtosComRisco.length > 0
      ? `Produtos com atenção de preço: ${produtosComRisco.map((produto) => produto.produto).join(', ')}.`
      : 'Não foram encontrados produtos com margem crítica entre os itens que possuem custo cadastrado.';

  const desperdicios =
    ingredientesFrequentes.length > 0
      ? `Ingredientes recorrentes como ${ingredientesFrequentes.join(', ')} devem ser acompanhados no estoque para reduzir desperdícios.`
      : 'O cadastro de ingredientes ainda é pequeno; inclua os insumos de cada produto para identificar possíveis desperdícios.';

  const custosPendentes =
    produtosSemCusto.length > 0
      ? ` Também é importante completar o custo de produção de ${produtosSemCusto.join(', ')}.`
      : '';

  return `Os dados indicam que ${produtoMaisLucrativo.produto} é o produto mais lucrativo, com lucro calculado de ${formatarMoeda(
    produtoMaisLucrativo.lucroCalculado,
  )}. O produto com menor lucro calculado é ${produtoMenosLucrativo.produto}, com ${formatarMoeda(
    produtoMenosLucrativo.lucroCalculado,
  )}. ${risco} ${desperdicios} Recomenda-se priorizar a divulgação dos itens de maior margem, revisar receitas com baixo retorno e negociar melhores condições para os ingredientes mais usados.${custosPendentes}`;
};

const listarIngredientesFrequentes = (produtos: ProdutoAnaliseFinanceira[]) => {
  const contagem = new Map<string, number>();

  produtos.forEach((produto) => {
    produto.ingredientes.forEach((ingrediente) => {
      const key = ingrediente.trim().toLowerCase();
      if (!key) return;
      contagem.set(key, (contagem.get(key) ?? 0) + 1);
    });
  });

  return [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([ingrediente]) => ingrediente);
};
