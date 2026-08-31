import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, setLogLevel } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDGe87Cd63VfSsy_n1EC4ZesrS3DeV7yD4",
  authDomain: "ponto-etiqueta.firebaseapp.com",
  databaseURL: "https://ponto-etiqueta-default-rtdb.firebaseio.com",
  projectId: "ponto-etiqueta",
  storageBucket: "ponto-etiqueta.firebasestorage.app",
  messagingSenderId: "1066790760822",
  appId: "1:1066790760822:web:8888f7cfe756a5c5498a57",
  measurementId: "G-06H7H9GGH9"
};

const app = initializeApp(firebaseConfig);
// Os logs detalhados mostram no console o RPC do Firestore, incluindo a operação
// e eventuais respostas/erros recebidos. Em produção, mantemos apenas o padrão.
setLogLevel(import.meta.env.DEV ? "debug" : "error");
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : undefined;
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
