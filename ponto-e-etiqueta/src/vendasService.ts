import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { type Cliente, type Venda } from "./types";

const vendasCollection = collection(db, "compras");
const clientesCollection = collection(db, "clientes");

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

export const salvarCliente = async (cliente: Pick<Cliente, "nome" | "telefone" | "observacoes">) => {
  const nome = cliente.nome.trim();
  const telefoneDigitos = extrairDigitosTelefone(cliente.telefone ?? "");

  if (!nome) {
    throw new Error("Informe o nome da cliente.");
  }

  if (!telefoneCelularValido(telefoneDigitos)) {
    throw new Error("Informe um celular válido com DDD e 11 dígitos.");
  }

  const clienteRef = doc(clientesCollection, telefoneDigitos);
  const clienteSnap = await getDoc(clienteRef);
  const agora = Timestamp.now();
  const payload = {
    nome,
    telefone: formatarTelefoneCliente(telefoneDigitos),
    telefoneDigitos,
    observacoes: cliente.observacoes?.trim() ?? "",
    atualizadoEm: agora,
    ...(clienteSnap.exists() ? {} : { criadoEm: agora }),
  };

  await setDoc(clienteRef, payload, { merge: true });

  return {
    id: telefoneDigitos,
    ...payload,
  };
};

export const registrarCompra = async (venda: Omit<Venda, "id" | "dataRegistro">) => {
  try {
    const clienteId = venda.clienteId || normalizarIdCliente(venda.nomeCliente);
    const clienteRef = doc(clientesCollection, clienteId);
    const clienteSnap = await getDoc(clienteRef);

    await setDoc(
      clienteRef,
      {
        nome: venda.nomeCliente.trim(),
        atualizadoEm: Timestamp.now(),
        ...(clienteSnap.exists() ? {} : { criadoEm: Timestamp.now() }),
      },
      { merge: true }
    );

    const payload = {
      ...venda,
      clienteId,
      dataCompra: venda.dataCompra ? Timestamp.fromDate(new Date(venda.dataCompra as Date)) : Timestamp.now(),
      dataRecebimento: Timestamp.fromDate(new Date(venda.dataRecebimento as Date)),
      dataRegistro: Timestamp.now(),
    };

    const docRef = await addDoc(vendasCollection, payload);
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

  await updateDoc(vendaRef, payload);
};

export const observarClientes = (callback: (clientes: Cliente[]) => void, onError?: (error: Error) => void) => {
  const q = query(clientesCollection, orderBy("nome", "asc"));

  const unsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      const clientes: Cliente[] = querySnapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...docSnapshot.data(),
      })) as Cliente[];
      callback(clientes);
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
