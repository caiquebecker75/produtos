// Hash da senha de acesso de uma página (usado na página e no painel; tem de ser idêntico nos dois).
// Sem diferença entre maiúsculas e minúsculas e sem espaços nas pontas: no celular o teclado costuma capitalizar.
export const normalizarSenha = (s) => String(s ?? '').trim().toLowerCase();

export async function hashSenha(slug, senha) {
  const dados = new TextEncoder().encode(`${slug}:${normalizarSenha(senha)}`);
  const buf = await crypto.subtle.digest('SHA-256', dados);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
