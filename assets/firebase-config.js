// Firebase do sistema de instalações 75 LAB (projeto instalacoes-75lab).
// Estes valores são públicos por natureza; quem protege os dados são as regras em firestore.rules:
// qualquer página de produto só CRIA registros e só a equipe 75 LAB (login Google) lê.
export const firebaseConfig = {
  apiKey: 'AIzaSyCb4C2BUehqzHnhEZT8FRF845czRvHupOk',
  authDomain: 'instalacoes-75lab.firebaseapp.com',
  projectId: 'instalacoes-75lab',
  storageBucket: 'instalacoes-75lab.firebasestorage.app',
  messagingSenderId: '313026663665',
  appId: '1:313026663665:web:ddece8ae48112ea66c0550',
};

export const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
