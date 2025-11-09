document.addEventListener('DOMContentLoaded', () => boot());

function boot(){
  // ====== CONFIG ======
  const EMOJIS_BASE = ["💛","🍿","👽","🌹","🦋","🍕","🎲","😂","🐱","🐶","🍔","🎧"];
  const TIME_DEFAULT = 75; // segundos

  // ====== ESTADO ======
  const state = {
    openCards: [],
    moves: 0,
    pairs: 0,
    time: TIME_DEFAULT,
    timerId: null,
    started: false,
    ended: false,
    deck: [],
    deckSize: 0,
  };

  // ====== DOM ======
  const sFlip  = document.getElementById('s-flip');
  const sGood  = document.getElementById('s-good');
  const sEnd   = document.getElementById('s-end');
  [sFlip, sGood, sEnd].forEach(a => { try{ a.volume = 0.7; }catch{} });

  const elTime  = document.getElementById('time');
  const elMoves = document.getElementById('moves');
  const elPairs = document.getElementById('pairs');

  const gameEl     = document.querySelector('.game');
  const btnStart   = document.getElementById('start');
  const btnReset   = document.getElementById('reset');
  const container  = document.getElementById('container');

  const modal   = document.getElementById('modal');
  const mTitle  = document.getElementById('modal-title');
  const mMsg    = document.getElementById('modal-msg');
  const mMoves  = document.getElementById('m-moves');
  const mTime   = document.getElementById('m-time');
  const mPlay   = document.getElementById('modal-play');
  const mClose  = document.getElementById('modal-close');

  // ====== UTILS ======
  const dupPairs = arr => arr.flatMap(x => [x,x]);

  function fisherYates(a){
    const arr = [...a];
    for(let i=arr.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // lê o número de colunas atual a partir do CSS (--cols)
  const getCols = () => {
    const v = getComputedStyle(gameEl).getPropertyValue('--cols').trim();
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : 6;
  };

  function isAdjacent(i,j,cols=getCols()){
    const r1=Math.floor(i/cols), c1=i%cols;
    const r2=Math.floor(j/cols), c2=j%cols;
    return Math.max(Math.abs(r1-r2), Math.abs(c1-c2))<=1; // inclui diagonais
  }

  // Embaralhamento "intermediário": evita par colado (h, v, diag), respeitando as colunas atuais
  function buildDeckIntermediate(){
    const base = dupPairs(EMOJIS_BASE);   // 24
    const MAX_TRIES = 5000;
    const cols = getCols();
    for(let tries=0; tries<MAX_TRIES; tries++){
      const deck = fisherYates(base);
      const map = new Map();
      deck.forEach((sym,idx)=>{
        if(!map.has(sym)) map.set(sym,[]);
        map.get(sym).push(idx);
      });
      let ok = true;
      for(const pos of map.values()){
        if(pos.length!==2) continue;
        if(isAdjacent(pos[0],pos[1],cols)){ ok=false; break; }
      }
      if(ok) return deck;
    }
    return fisherYates(base); // fallback
  }

  // ====== HUD ======
  function updateHUD(){
    elTime.textContent  = state.time;
    elMoves.textContent = state.moves;
    elPairs.textContent = state.pairs;
  }
  function setLockedUI(locked){
    gameEl.classList.toggle('locked', locked);
    btnStart.disabled = !locked; // obriga clicar em INICIAR
  }

  // ====== TIMER ======
  function tick(){
    if(state.ended) return;
    state.time--;

    if(state.time <= 10) elTime.classList.add('danger');
    else                 elTime.classList.remove('danger');

    updateHUD();

    if(state.time <= 0){
      endGame('timeout');
    }
  }
  function startTimer(){
    clearInterval(state.timerId);
    state.timerId = setInterval(tick, 1000);
  }

  // ====== BOARD ======
  function makeDeck(){
    state.deck = buildDeckIntermediate();
    state.deckSize = state.deck.length; // 24
  }

  function renderBoard(){
    gameEl.innerHTML = '';
    state.deck.forEach(sym=>{
      const card = document.createElement('div');
      card.className = 'item';
      card.innerHTML = `
        <span class="face front">${sym}</span>
        <span class="face back"></span>
      `;
      card.addEventListener('click', onCardClick);
      gameEl.appendChild(card);
    });
  }

  function onCardClick(e){
    if(!state.started || state.ended) return;

    const card = e.currentTarget;
    if(card.classList.contains('boxOpen') || card.classList.contains('boxMatch')) return;
    if(state.openCards.length>=2) return;

    card.classList.add('boxOpen');
    state.openCards.push(card);

    // Som: virar carta (click)
    try{ sFlip.currentTime = 0; sFlip.play(); }catch{}

    if(state.openCards.length===2){
      state.moves++;
      updateHUD();
      setTimeout(checkMatch, 320);
    }
  }

  function checkMatch(){
    const [a,b] = state.openCards;
    if(!a || !b) return;
    const va = a.querySelector('.front').textContent;
    const vb = b.querySelector('.front').textContent;

    if(va===vb){
      a.classList.add('boxMatch');
      b.classList.add('boxMatch');
      state.pairs++;

      // Som: acertou par
      try{ sGood.currentTime = 0; sGood.play(); }catch{}
    }else{
      a.classList.remove('boxOpen');
      b.classList.remove('boxOpen');
      // (sem som de erro)
    }

    state.openCards = [];
    updateHUD();

    // Vitória
    if(state.pairs === state.deckSize/2){
      endGame('win');
    }
  }

  // ====== FIM DE JOGO ======
  function endGame(type){
    if(state.ended) return;
    state.ended = true;

    clearInterval(state.timerId);
    state.started = false;
    setLockedUI(true);
    container.classList.remove('active');

    // Som final único (ganhou ou perdeu)
    try{ sEnd.currentTime = 0; sEnd.play(); }catch{}

    openModal(type);
  }

  // ====== MODAL ======
  function openModal(type){
    const timeLeft  = Math.max(0, state.time);
    const timeSpent = TIME_DEFAULT - timeLeft;

    if(type==='win'){
      mTitle.textContent = '🎉 Vitória!';
      mMsg.textContent   = 'Você encontrou todos os pares!';
      mMoves.textContent = state.moves;
      mTime.textContent  = `${timeLeft}s restantes`;
    }else{
      mTitle.textContent = '⏳ Tempo esgotado!';
      mMsg.textContent   = 'Tente novamente.';
      mMoves.textContent = state.moves;
      mTime.textContent  = `${timeSpent}s jogados`;
    }
    modal.classList.add('show');
  }

  function closeModal(){
    modal.classList.remove('show');
  }

  // ====== FLUXO ======
  function resetGame(){
    clearInterval(state.timerId);
    state.started = false;
    state.ended   = false;
    state.openCards = [];
    state.moves  = 0;
    state.pairs  = 0;
    state.time   = TIME_DEFAULT;
    elTime.classList.remove('danger');
    updateHUD();
    makeDeck();
    renderBoard();
    setLockedUI(true);
    container.classList.remove('active');
  }

  function startGame(){
    if(state.started) return;
    state.started = true;
    state.ended   = false;
    state.openCards = [];
    state.moves  = 0;
    state.pairs  = 0;
    state.time   = TIME_DEFAULT;
    elTime.classList.remove('danger');
    updateHUD();
    makeDeck();       // re-embaralha ao iniciar (respeita colunas atuais)
    renderBoard();
    startTimer();
    setLockedUI(false);
    container.classList.add('active');
  }

  // Init
  updateHUD();
  makeDeck();
  renderBoard();
  setLockedUI(true);

  btnStart.addEventListener('click', startGame);
  btnReset.addEventListener('click', () => { closeModal(); resetGame(); });

  mPlay.addEventListener('click', () => { closeModal(); resetGame(); startGame(); });
  mClose.addEventListener('click', () => { closeModal(); });
}
