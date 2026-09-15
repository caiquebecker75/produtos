// Conexão única com o Firestore (versão lite) para as páginas de produto. Carrega só quando alguém precisa.
import { firebaseConfig, FIREBASE_SDK } from './firebase-config.js?v=1';

let conexao;
export function db() {
  conexao ??= Promise.all([
    import(`${FIREBASE_SDK}/firebase-app.js`),
    import(`${FIREBASE_SDK}/firebase-firestore-lite.js`),
  ]).then(([app, fs]) => ({ fs, db: fs.getFirestore(app.initializeApp(firebaseConfig)) }));
  return conexao;
}
