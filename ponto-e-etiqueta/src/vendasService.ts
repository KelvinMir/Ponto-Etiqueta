import { collection, addDoc, onSnapshot, query, orderBy, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import { type Venda } from "./types";

const vendasCollection = collection(db, "vendas");

export const adicionarVenda = async (venda: Omit<Venda, "id" | "dataRegistro">) => {
  try {
    const docRef = await addDoc(vendasCollection, {
      ...venda,
      dataRegistro: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    console.error("Erro ao adicionar venda: ", error);
    throw error;
  }
};

export const observarVendas = (callback: (vendas: Venda[]) => void, onError?: (error: Error) => void) => {
  const q = query(vendasCollection, orderBy("dataRegistro", "desc"));
  
  const unsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      const vendas: Venda[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Venda[];
      callback(vendas);
    },
    (error) => {
      console.error("Erro ao observar vendas: ", error);
      onError?.(error);
    }
  );

  return unsubscribe;
};
