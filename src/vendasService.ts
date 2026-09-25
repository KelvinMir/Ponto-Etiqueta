import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { type Cliente, type Venda } from "./types";

const vendasCollection = collection(db, "compras");
const clientesCollection = collection(db, "clientes");
const executarOperacao = async <T>(
  nome: string,
  payload: unknown,
  operacao: () => Promise<T>
) => {
  const inicio = performance.now();
  const id = `${nome}-${Date.now()}`;
  console.groupCollapsed(`[Firestore] ${id} →`);
  console.log("payload enviado:", payload);
  console.groupEnd();

  try {
    const resposta = await operacao();
    console.groupCollapsed(`[Firestore] ${id} ← OK (${Math.round(performance.now() - inicio)}ms)`);
    console.log("resposta:", resposta ?? "ACK recebido (sem corpo de resposta)");
    console.groupEnd();
    return resposta;
  } catch (error) {
    console.groupCollapsed(`[Firestore] ${id} ← ERRO (${Math.round(performance.now() - inicio)}ms)`);
    console.log("resposta/erro:", error);
    console.groupEnd();
    throw error;
  }
};

export const extrairDigitosTelefone = (telefone: string) => telefone.replace(/\D/g, "").slice(0, 11);

export const telefoneCelularValido = (telefone: string) => {
  const telefoneDigitos = extrairDigitosTelefone(telefone);
  return /^[1-9]{2}9\d{8}$/.test(telefoneDigitos);
};

export const formatarTelefoneCliente = (telefone: string) => {
  const telefoneDigitos = extrairDigitosTelefone(telefone);

  if (!telefoneDigitos) return "";
  if (telefoneDigitos.length <= 2) return `(${telefoneDigitos}`;
  if (telefoneDigitos.length <= 3) return `(${telefoneDigitos.slice(0, 2)}) ${telefoneDigitos.slice(2)}`;
  if (telefoneDigitos.length <= 7) {
    return `(${telefoneDigitos.slice(0, 2)}) ${telefoneDigitos.slice(2, 3)} ${telefoneDigitos.slice(3)}`;
  }

  return `(${telefoneDigitos.slice(0, 2)}) ${telefoneDigitos.slice(2, 3)} ${telefoneDigitos.slice(3, 7)}-${telefoneDigitos.slice(7)}`;
};

const normalizarIdCliente = (nome: string) => {
  return nome
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "cliente";
};

const validarDadosCliente = (cliente: Pick<Cliente, "nome" | "telefone" | "observacoes">) => {
  const nome = cliente.nome.trim();
  const telefoneDigitos = extrairDigitosTelefone(cliente.telefone ?? "");

  if (!nome) {
    throw new Error("Informe o nome da cliente.");
  }

  if (!telefoneCelularValido(telefoneDigitos)) {
    throw new Error("Informe um celular válido com DDD e 11 dígitos.");
  }

  return {
    nome,
    telefoneDigitos,
    telefone: formatarTelefoneCliente(telefoneDigitos),
    observacoes: cliente.observacoes?.trim() ?? "",
  };
};

export const salvarCliente = async (cliente: Pick<Cliente, "nome" | "telefone" | "observacoes">) => {
  const dados = validarDadosCliente(cliente);
  const clienteRef = doc(clientesCollection, dados.telefoneDigitos);
  const agora = Timestamp.now();
  const payload = {
    ...dados,
    atualizadoEm: agora,
  };

  await executarOperacao("salvarCliente", payload, () => setDoc(clienteRef, payload, { merge: true }));

  return {
    id: dados.telefoneDigitos,
    ...payload,
  };
};

export const atualizarCliente = async (
  clienteId: string,
  cliente: Pick<Cliente, "nome" | "telefone" | "observacoes">
) => {
  const dados = validarDadosCliente(cliente);
  const novoId = dados.telefoneDigitos;
  const payload = { ...dados, atualizadoEm: Timestamp.now() };

  await executarOperacao("atualizarCliente", payload, () => setDoc(doc(clientesCollection, novoId), payload, { merge: true }));

  if (novoId !== clienteId) {
    await executarOperacao("removerClienteAnterior", { clienteId }, () => deleteDoc(doc(clientesCollection, clienteId)));
  }

  return { id: novoId, ...payload };
};

export const excluirCliente = async (clienteId: string) => {
  await executarOperacao("excluirCliente", { clienteId }, () => deleteDoc(doc(clientesCollection, clienteId)));
};

export const registrarCompra = async (venda: Omit<Venda, "id" | "dataRegistro">) => {
  try {
    const clienteId = venda.clienteId || normalizarIdCliente(venda.nomeCliente);

    const payload = {
      ...venda,
      clienteId,
      dataCompra: venda.dataCompra ? Timestamp.fromDate(new Date(venda.dataCompra as Date)) : Timestamp.now(),
      dataRecebimento: Timestamp.fromDate(new Date(venda.dataRecebimento as Date)),
      dataRegistro: Timestamp.now(),
    };

    const docRef = await executarOperacao("registrarCompra", payload, () => addDoc(vendasCollection, payload));
    return { id: docRef.id, clienteId };
  } catch (error) {
    console.error("Erro ao registrar compra: ", error);
    throw error;
  }
};

export const adicionarVenda = async (venda: Omit<Venda, "id" | "dataRegistro">) => {
  return registrarCompra(venda);
};

export const atualizarPagamentoVenda = async (
  vendaId: string,
  dados: { valorRecebido: number; dataRecebimento?: Date }
) => {
  const vendaRef = doc(vendasCollection, vendaId);
  const payload: Record<string, unknown> = {
    valorRecebido: dados.valorRecebido,
    valorAindaPagar: Math.max(0, Number((await getDoc(vendaRef)).data()?.valorTotalCompra ?? 0) - dados.valorRecebido),
  };

  if (dados.dataRecebimento) {
    payload.dataRecebimento = Timestamp.fromDate(dados.dataRecebimento);
  }

  await executarOperacao("atualizarPagamentoVenda", payload, () => updateDoc(vendaRef, payload));
};

export const observarClientes = (callback: (clientes: Cliente[]) => void, onError?: (error: Error) => void) => {
  const montarClientes = (docs: ReadonlyArray<{ id: string; data: () => Record<string, unknown> }>) => {
    return docs
      .map((docSnapshot) => {
        const dados = docSnapshot.data();
        return {
          id: docSnapshot.id,
          ...dados,
          nome: typeof dados.nome === "string" && dados.nome.trim() ? dados.nome : docSnapshot.id,
        };
      })
      .sort((clienteA, clienteB) =>
        clienteA.nome.localeCompare(clienteB.nome, "pt-BR", { sensitivity: "base" })
      ) as Cliente[];
  };

  const unsubscribe = onSnapshot(
    clientesCollection,
    (querySnapshot) => {
      console.debug("[Firestore] snapshot clientes recebido:", {
        quantidade: querySnapshot.size,
        doCache: querySnapshot.metadata.fromCache,
        pendente: querySnapshot.metadata.hasPendingWrites,
      });
      callback(montarClientes(querySnapshot.docs));
    },
    (error) => {
      console.error("Erro ao observar clientes: ", error);
      onError?.(error);
    }
  );

  return unsubscribe;
};

export const observarVendas = (callback: (vendas: Venda[]) => void, onError?: (error: Error) => void) => {
  const q = query(vendasCollection, orderBy("dataRegistro", "desc"));

  const unsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      console.debug("[Firestore] snapshot vendas recebido:", {
        quantidade: querySnapshot.size,
        doCache: querySnapshot.metadata.fromCache,
        pendente: querySnapshot.metadata.hasPendingWrites,
      });
      const vendas: Venda[] = querySnapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...docSnapshot.data()
      })) as Venda[];
      callback(vendas);
    },
    (error) => {
      console.error("Erro ao observar compras: ", error);
      onError?.(error);
    }
  );

  return unsubscribe;
};
