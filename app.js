const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const LIMITE = 4_000_000; // o Vercel aceita cerca de 4,5 MB por pedido
const semMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- aviso ---------- */
let tAviso;
function aviso(texto, erro = false) {
  const el = $('#aviso');
  el.textContent = texto;
  el.classList.toggle('erro', erro);
  el.hidden = false;
  clearTimeout(tAviso);
  tAviso = setTimeout(() => (el.hidden = true), 4500);
}

/* ---------- lanterna no topo ---------- */
const oculto = $('#oculto');
$('#hero').addEventListener('pointermove', e => {
  const r = oculto.getBoundingClientRect();
  oculto.style.setProperty('--x', `${e.clientX - r.left}px`);
  oculto.style.setProperty('--y', `${e.clientY - r.top}px`);
});
$('#hero').addEventListener('pointerleave', () => {
  oculto.style.setProperty('--x', '-999px');
  oculto.style.setProperty('--y', '-999px');
});

/* ---------- abas ---------- */
$$('.aba').forEach(aba =>
  aba.addEventListener('click', () => {
    $$('.aba').forEach(a => a.setAttribute('aria-selected', a === aba));
    $$('.painel').forEach(p => (p.hidden = p.id !== aba.getAttribute('aria-controls')));
  })
);

/* ---------- zonas de largar ficheiros ---------- */
function zona(el, aoEscolher) {
  const input = $('input', el);
  const escolher = f => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return aviso('Escolha um ficheiro de imagem (PNG de preferência).', true);
    aoEscolher(f);
  };
  input.addEventListener('change', () => escolher(input.files[0]));
  ['dragenter', 'dragover'].forEach(t =>
    el.addEventListener(t, e => { e.preventDefault(); el.classList.add('sobre'); })
  );
  ['dragleave', 'drop'].forEach(t =>
    el.addEventListener(t, e => { e.preventDefault(); el.classList.remove('sobre'); })
  );
  el.addEventListener('drop', e => escolher(e.dataTransfer.files[0]));
}

function mostrarPrevia(el, url) {
  const img = $('img', el);
  img.src = url;
  img.hidden = false;
  $('.dica', el).hidden = true;
}

function carregar(file) {
  return new Promise((ok, falha) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => falha(new Error('Não foi possível ler esta imagem.'));
    img.src = URL.createObjectURL(file);
  });
}

/* reduz a imagem no navegador se for grande demais para o servidor */
async function preparar(file) {
  const img = await carregar(file);
  if (file.size <= LIMITE) return { file, w: img.naturalWidth, h: img.naturalHeight };
  let escala = Math.sqrt(LIMITE / file.size) * 0.9;
  for (let i = 0; i < 6; i++) {
    const c = document.createElement('canvas');
    c.width = Math.floor(img.naturalWidth * escala);
    c.height = Math.floor(img.naturalHeight * escala);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    if (blob.size <= LIMITE) {
      return { file: new File([blob], 'capa.png', { type: 'image/png' }), w: c.width, h: c.height };
    }
    escala *= 0.8;
  }
  throw new Error('A imagem é grande demais, mesmo depois de reduzida.');
}

/* tamanho do payload depois da cifra (sal + token Fernet em base64) */
function tamanhoPayload(n, senha) {
  if (!senha) return n;
  const bruto = 57 + (Math.floor(n / 16) + 1) * 16;
  return 16 + Math.ceil(bruto / 3) * 4;
}

async function enviar(url, campos) {
  const fd = new FormData();
  Object.entries(campos).forEach(([k, v]) => fd.append(k, v));
  const r = await fetch(url, { method: 'POST', body: fd });
  if (r.status === 413) throw new Error('A imagem é grande demais para o servidor.');
  return r;
}

/* ---------- esconder ---------- */
const capa = { file: null, w: 0, h: 0 };

zona($('#zona-capa'), async f => {
  try {
    Object.assign(capa, await preparar(f));
    mostrarPrevia($('#zona-capa'), URL.createObjectURL(capa.file));
    atualizarUso();
  } catch (e) {
    aviso(e.message, true);
  }
});

function atualizarUso() {
  const texto = $('#msg').value;
  const senha = $('#senha-esconder').value;
  const cap = capa.file ? Math.floor((capa.w * capa.h * 3) / 8) - 8 : 0;
  const usado = tamanhoPayload(new TextEncoder().encode(texto).length, senha);
  $('#barra i').style.width = (cap > 0 ? Math.min(100, (usado / cap) * 100) : 0) + '%';
  $('#barra').classList.toggle('cheia', capa.file && usado > cap);
  $('#uso').textContent = capa.file
    ? `${usado} de ${cap} bytes usados`
    : 'Escolha uma imagem para ver quanto cabe.';
  $('#btn-esconder').disabled = !capa.file || !texto || usado > cap;
}
$('#msg').addEventListener('input', atualizarUso);
$('#senha-esconder').addEventListener('input', atualizarUso);

$('#btn-esconder').addEventListener('click', async () => {
  const btn = $('#btn-esconder');
  btn.disabled = true;
  btn.textContent = 'A esconder…';
  try {
    const r = await enviar('/api/hide', {
      image: capa.file,
      message: $('#msg').value,
      password: $('#senha-esconder').value,
    });
    if (!r.ok) {
      const dados = await r.json().catch(() => ({}));
      throw new Error(dados.error || 'Não foi possível esconder a mensagem nesta imagem.');
    }
    const psnr = r.headers.get('X-PSNR');
    const url = URL.createObjectURL(await r.blob());
    $('#img-antes').src = URL.createObjectURL(capa.file);
    $('#img-depois').src = url;
    $('#baixar').href = url;
    $('#res-vazio').hidden = true;
    $('#res').hidden = false;
    aviso(psnr && psnr !== 'inf'
      ? `Mensagem escondida. Qualidade: ${psnr} dB (acima de 50 dB a diferença é invisível).`
      : 'Mensagem escondida. Descarregue o PNG.');
  } catch (e) {
    aviso(e.message, true);
  } finally {
    btn.textContent = 'Esconder mensagem';
    atualizarUso();
  }
});

$('#cursor').addEventListener('input', e =>
  $('#comparador').style.setProperty('--p', e.target.value + '%')
);

/* ---------- revelar ---------- */
let seleccionada = null;
zona($('#zona-sel'), f => {
  seleccionada = f;
  mostrarPrevia($('#zona-sel'), URL.createObjectURL(f));
  $('#btn-rev').disabled = false;
});

function decifrar(el, texto) {
  if (semMovimento) { el.textContent = texto; return; }
  const ruido = '▓▒░#%&@$?/\\';
  let i = 0;
  const passo = Math.max(1, Math.ceil(texto.length / 60));
  const t = setInterval(() => {
    i += passo;
    const resto = Math.max(0, Math.min(8, texto.length - i));
    const lixo = Array.from({ length: resto }, () => ruido[(Math.random() * ruido.length) | 0]).join('');
    el.textContent = texto.slice(0, i) + lixo;
    if (i >= texto.length) { clearInterval(t); el.textContent = texto; }
  }, 30);
}

$('#btn-rev').addEventListener('click', async () => {
  const btn = $('#btn-rev');
  btn.disabled = true;
  btn.textContent = 'A procurar…';
  try {
    const r = await enviar('/api/reveal', { image: seleccionada, password: $('#senha-rev').value });
    const dados = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(dados.error || 'Nada encontrado ou chave incorrecta.');
    decifrar($('#carta'), dados.message);
  } catch (e) {
    $('#carta').textContent = 'A mensagem aparece aqui.';
    aviso(e.message, true);
  } finally {
    btn.textContent = 'Revelar mensagem';
    btn.disabled = false;
  }
});

/* ---------- lupa ---------- */
let paraLupa = null;
zona($('#zona-lupa'), f => {
  paraLupa = f;
  mostrarPrevia($('#zona-lupa'), URL.createObjectURL(f));
  $('#btn-lupa').disabled = false;
});

$('#btn-lupa').addEventListener('click', async () => {
  const btn = $('#btn-lupa');
  btn.disabled = true;
  btn.textContent = 'A ampliar…';
  try {
    const r = await enviar('/api/forensic', { image: paraLupa });
    if (!r.ok) throw new Error('Não foi possível analisar esta imagem.');
    $('#lupa-img').src = URL.createObjectURL(await r.blob());
    $('#lupa-img').hidden = false;
    $('#lupa-vazio').hidden = true;
  } catch (e) {
    aviso(e.message, true);
  } finally {
    btn.textContent = 'Ver os bits escondidos';
    btn.disabled = false;
  }
});