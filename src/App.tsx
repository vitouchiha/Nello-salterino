import { useEffect, useRef, useState } from 'react';

let audioCtx: AudioContext | null = null;

const playSound = (type: 'jump' | 'score' | 'land' | 'hit') => {
  if (typeof window === 'undefined') return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    const t = audioCtx.currentTime;

    if (type === 'jump') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(300, t + 0.1);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
      osc.start(t);
      osc.stop(t + 0.1);
    } else if (type === 'score') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(400, t);
      osc.frequency.setValueAtTime(600, t + 0.05);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
      osc.start(t);
      osc.stop(t + 0.1);
    } else if (type === 'land') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(80, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.05);
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
      osc.start(t);
      osc.stop(t + 0.05);
    } else if (type === 'hit') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.2);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
      osc.start(t);
      osc.stop(t + 0.2);
    }
  } catch(e) {
    // Ignore audio errors
  }
};

// Costanti di gioco
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const GRAVITY = 0.6;
const JUMP_VELOCITY = -12;
const GAME_SPEED = 6;

type GameState = 'START' | 'PLAYING' | 'GAMEOVER';

interface Dog {
  x: number;
  y: number;
  w: number;
  h: number;
  vy: number;
}

interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Sausage {
  x: number;
  y: number;
  w: number;
  h: number;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  // Variabili mutabili per il loop senza causare re-render
  const stateRef = useRef({
    gameState: 'START' as GameState,
    score: 0,
    dog: { x: 80, y: 300, w: 40, h: 40, vy: 0 } as Dog,
    obstacles: [] as Obstacle[],
    sausages: [] as Sausage[],
    frames: 0,
    nextSpawn: 60,
    nextSausageSpawn: 90,
  });

  const animationRef = useRef<number>(null);

  // Sincronizza lo stato React con lo stato mutabile per gli eventi
  useEffect(() => {
    stateRef.current.gameState = gameState;
  }, [gameState]);

  const jump = () => {
    // Inizializza audio alla prima interazione
    if (!audioCtx && typeof window !== 'undefined') {
      try { audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch(e){}
    }
    if (audioCtx?.state === 'suspended') {
      audioCtx.resume();
    }

    const s = stateRef.current;
    if (s.gameState === 'START' || s.gameState === 'GAMEOVER') {
      // Inizia o riavvia il gioco
      s.dog = { x: 80, y: 300, w: 40, h: 40, vy: 0 };
      s.obstacles = [];
      s.sausages = [];
      s.score = 0;
      s.frames = 0;
      s.nextSpawn = 60;
      s.nextSausageSpawn = 90;
      setScore(0);
      setGameState('PLAYING');
    } else if (s.gameState === 'PLAYING') {
      // Salta solo se a terra
      if (s.dog.y >= 300) {
        s.dog.vy = JUMP_VELOCITY;
        playSound('jump');
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Loop di gioco principale
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const drawDog = (dog: Dog) => {
      // Corpo principale nero scuro
      ctx.fillStyle = '#111'; 
      ctx.fillRect(dog.x, dog.y + 15, 30, 20); // Corpo
      
      // Testa
      ctx.fillRect(dog.x + 20, dog.y + 5, 20, 18); 
      
      // Musetto/Barba (grigio scuro/marrone - da schnauzer)
      ctx.fillStyle = '#4a3b32';
      ctx.fillRect(dog.x + 35, dog.y + 15, 12, 12);
      ctx.fillRect(dog.x + 30, dog.y + 20, 10, 7); 
      
      // Naso nero
      ctx.fillStyle = '#000';
      ctx.fillRect(dog.x + 43, dog.y + 13, 6, 4);
      
      // Occhio (castano con riflesso)
      ctx.fillStyle = '#000';
      ctx.fillRect(dog.x + 28, dog.y + 9, 4, 4);
      ctx.fillStyle = '#fff';
      ctx.fillRect(dog.x + 30, dog.y + 9, 2, 2);
      
      // Orecchie piegate
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(dog.x + 16, dog.y + 3, 10, 8);
      ctx.fillRect(dog.x + 14, dog.y + 8, 4, 6);

      // Collare grigio/metallo
      ctx.fillStyle = '#888';
      ctx.fillRect(dog.x + 22, dog.y + 22, 6, 2);

      // Coda
      ctx.fillStyle = '#111';
      ctx.fillRect(dog.x - 6, dog.y + 18, 6, 4);
      ctx.fillRect(dog.x - 8, dog.y + 16, 4, 4);

      // Zampe (grigiastre/argento)
      const legY = dog.y + 35;
      ctx.fillStyle = '#888';
      
      if (stateRef.current.gameState === 'PLAYING' && dog.y >= 300) {
        // Animazione corsa
        if (Math.floor(stateRef.current.frames / 4) % 2 === 0) {
          ctx.fillRect(dog.x + 4, legY, 6, 10);
          ctx.fillRect(dog.x + 24, legY, 6, 12);
        } else {
          ctx.fillRect(dog.x + 0, legY - 2, 6, 12);
          ctx.fillRect(dog.x + 20, legY - 2, 6, 12);
        }
      } else if (dog.y < 300) {
         // Salto
         ctx.fillRect(dog.x + 2, legY - 4, 8, 8);
         ctx.fillRect(dog.x + 22, legY - 4, 8, 8);
      } else {
         // Ferma
         // Zampe posteriori (più scure)
         ctx.fillStyle = '#555';
         ctx.fillRect(dog.x + 10, legY, 4, 8);
         ctx.fillRect(dog.x + 28, legY, 4, 8);
         
         // Zampe anteriori
         ctx.fillStyle = '#888';
         ctx.fillRect(dog.x + 2, legY, 6, 10);
         ctx.fillRect(dog.x + 20, legY, 6, 10);
      }
    };

    const drawObstacle = (obs: Obstacle) => {
      ctx.fillStyle = '#c0392b'; // Bordo scuro
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      ctx.fillStyle = '#e74c3c'; // Interno rosso
      ctx.fillRect(obs.x + 4, obs.y + 4, obs.w - 8, obs.h - 4);
    };

    const drawSausage = (saus: Sausage) => {
      // Wurstel in pixel art
      ctx.fillStyle = '#a52a2a'; // Base rossa marroncina
      ctx.fillRect(saus.x + 2, saus.y + 2, saus.w - 4, saus.h - 4);
      
      // Contorni scuri
      ctx.fillStyle = '#5c1616';
      ctx.fillRect(saus.x, saus.y + 2, 2, saus.h - 4);
      ctx.fillRect(saus.x + saus.w - 2, saus.y + 2, 2, saus.h - 4);
      ctx.fillRect(saus.x + 2, saus.y, saus.w - 4, 2);
      ctx.fillRect(saus.x + 2, saus.y + saus.h - 2, saus.w - 4, 2);
      
      // Riflesso di luce
      ctx.fillStyle = '#e87272';
      ctx.fillRect(saus.x + 4, saus.y + 2, saus.w - 8, 2);
      
      // Segnetti della griglia
      ctx.fillStyle = '#5c1616';
      ctx.fillRect(saus.x + 8, saus.y + 4, 2, 4);
      ctx.fillRect(saus.x + 16, saus.y + 4, 2, 4);
      ctx.fillRect(saus.x + 24, saus.y + 4, 2, 4);
    };

    const drawBackground = () => {
      // Sfondo/Cielo
      ctx.fillStyle = '#70c5ce';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Nuvola a pixel
      ctx.fillStyle = '#FFFFFF';
      ctx.globalAlpha = 0.8;
      const cloudOffset = (stateRef.current.frames * 0.5) % (CANVAS_WIDTH + 200);
      const cx = CANVAS_WIDTH - cloudOffset;
      ctx.fillRect(cx, 100, 100, 40);
      ctx.fillRect(cx + 20, 140, 60, 20);
      ctx.globalAlpha = 1.0;

      // Terreno
      ctx.fillStyle = '#73bf2e';
      ctx.fillRect(0, 340, CANVAS_WIDTH, 60);

      // Bordo terreno
      ctx.fillStyle = '#4a8f1a';
      ctx.fillRect(0, 340, CANVAS_WIDTH, 8);
      
      // Strisce sul terreno (stile linear-gradient CSS)
      const offset = (stateRef.current.frames * GAME_SPEED) % 40;
      for (let i = -40; i < CANVAS_WIDTH + 40; i += 40) {
        ctx.fillRect(i - offset + 36, 340, 4, 60);
      }
    };

    const loop = () => {
      const s = stateRef.current;
      
      // Clear
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      drawBackground();

      if (s.gameState === 'PLAYING') {
        // Logica Cane
        s.dog.vy += GRAVITY;
        s.dog.y += s.dog.vy;

        // Collisione col terreno
        if (s.dog.y >= 300) {
          if (s.dog.y > 300 && s.dog.vy > GRAVITY) {
            playSound('land');
          }
          s.dog.y = 300;
          s.dog.vy = 0;
        }

        // Generazione ostacoli
        s.frames++;
        if (s.frames > s.nextSpawn) {
          s.obstacles.push({
            x: CANVAS_WIDTH,
            y: 300,
            w: 30, // Larghezza ostacolo
            h: 40 + Math.random() * 30 // Altezza casuale
          });
          s.nextSpawn = s.frames + 60 + Math.random() * 60; // Prossimo spawn casuale tra 60 e 120 frame
        }

        // Generazione wurstel (in aria)
        if (s.frames > s.nextSausageSpawn) {
          s.sausages.push({
            x: CANVAS_WIDTH,
            y: 160 + Math.random() * 80, // Altezza da salto
            w: 32,
            h: 12
          });
          s.nextSausageSpawn = s.frames + 50 + Math.random() * 80; // Wurstel spawnano un po' più spesso
        }

        // Hitbox cane
        const dogHitbox = { x: s.dog.x + 5, y: s.dog.y + 10, w: 35, h: 30 };

        // Logica Wurstels
        for (let i = s.sausages.length - 1; i >= 0; i--) {
          const saus = s.sausages[i];
          saus.x -= GAME_SPEED;
          drawSausage(saus);
          
          const sausHitbox = { x: saus.x, y: saus.y, w: saus.w, h: saus.h };
          
          // Collisione Cane - Wurstel
          if (
            dogHitbox.x < sausHitbox.x + sausHitbox.w &&
            dogHitbox.x + dogHitbox.w > sausHitbox.x &&
            dogHitbox.y < sausHitbox.y + sausHitbox.h &&
            dogHitbox.y + dogHitbox.h > sausHitbox.y
          ) {
            playSound('score');
            s.score += 50; // Tanti punti per i wurstel!
            setScore(s.score);
            s.sausages.splice(i, 1);
            continue;
          }

          if (saus.x + saus.w < 0) {
            s.sausages.splice(i, 1);
          }
        }

        // Logica Ostacoli
        for (let i = s.obstacles.length - 1; i >= 0; i--) {
          const obs = s.obstacles[i];
          obs.x -= GAME_SPEED;

          drawObstacle({ ...obs, y: 340 - obs.h }); // Disegna partendo da terra

          const obsHitbox = { x: obs.x, y: 340 - obs.h, w: obs.w, h: obs.h };

          if (
            dogHitbox.x < obsHitbox.x + obsHitbox.w &&
            dogHitbox.x + dogHitbox.w > obsHitbox.x &&
            dogHitbox.y < obsHitbox.y + obsHitbox.h &&
            dogHitbox.y + dogHitbox.h > obsHitbox.y
          ) {
            // GameOver
            if (s.gameState !== 'GAMEOVER') {
              playSound('hit');
              setGameState('GAMEOVER');
              if (s.score > highScore) {
                setHighScore(s.score);
              }
            }
          }

          // Rimuovi ostacoli fuori schermo + punteggio passivo
          if (obs.x + obs.w < 0) {
            s.obstacles.splice(i, 1);
            s.score += 5; // Punteggio minore per aver evitato
            setScore(s.score);
          }
        }
      } else {
        // Disegna cane da fermo se non stiamo giocando
        s.sausages.forEach(saus => drawSausage(saus));
        s.obstacles.forEach(obs => drawObstacle({ ...obs, y: 340 - obs.h }));
      }

      drawDog(s.dog);

      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [highScore]); // Dipendenza ridotta apposta per non riavviare il loop se non necessario

  return (
    <div 
      className="min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-center p-4 select-none touch-none"
      onClick={jump} // Salta al touch ovunque
    >
      <div className="w-full max-w-4xl flex items-center justify-between mb-4 text-white uppercase" style={{ textShadow: '4px 4px 0 #000' }}>
        <div>
          <h1 className="text-3xl text-white mb-2">Nello Salterino</h1>
          <p className="text-white text-xs tracking-wider" style={{ textShadow: '2px 2px 0 #000' }}>Tocca o premi Spazio x saltare e prendere i wurstel</p>
        </div>
        <div className="text-right">
          <p className="text-white text-lg">Score: {score.toString().padStart(4, '0')}</p>
          <p className="text-white text-sm">HI-Score: {highScore.toString().padStart(4, '0')}</p>
        </div>
      </div>

      <div className="relative border-[8px] border-[#333] bg-[#70c5ce] box-border">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full max-w-[800px] h-auto block"
        />
        
        {/* Schermate di UI sovraimpresse */}
        {gameState === 'START' && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-20 text-white text-center">
            <h1 className="text-3xl lg:text-4xl mb-4 text-white" style={{ textShadow: '4px 4px 0 #000' }}>NELLO SALTERINO</h1>
            <p className="mt-5 text-sm mb-5" style={{ textShadow: '2px 2px 0 #000' }}>PRESS SPACE OR TAP TO JUMP SECURE THE WURSTEL</p>
            <button 
              className="bg-[#f1c40f] border-x-0 border-t-0 border-b-[8px] border-[#f39c12] px-10 py-5 text-xl lg:text-2xl text-[#333] cursor-pointer mt-5 active:border-b-0 active:mt-[28px] transition-all font-[inherit]"
              onClick={(e) => { e.stopPropagation(); jump(); }}
            >
              START GAME
            </button>
          </div>
        )}

        {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-20 text-white text-center">
            <h1 className="text-3xl lg:text-4xl mb-2 text-white" style={{ textShadow: '4px 4px 0 #000' }}>GAME OVER</h1>
            <p className="text-[#f1c40f] mb-4 text-lg" style={{ textShadow: '2px 2px 0 #000' }}>Hai preso un ostacolo!</p>
            <button 
              className="bg-[#f1c40f] border-x-0 border-t-0 border-b-[8px] border-[#f39c12] px-10 py-5 text-xl lg:text-2xl text-[#333] cursor-pointer mt-5 active:border-b-0 active:mt-[28px] transition-all font-[inherit]"
              onClick={(e) => { e.stopPropagation(); jump(); }}
            >
              RETRY
            </button>
          </div>
        )}
      </div>

      <div className="mt-8 max-w-4xl w-full flex justify-center">
        {/* Controlli on-screen visibili su mobile come hint (anche se l'intero schermo reagisce al tap) */}
        <button 
          className="md:hidden bg-[#f1c40f] border-x-0 border-t-0 border-b-[8px] border-[#f39c12] px-8 py-4 text-xl text-[#333] cursor-pointer active:border-b-0 active:mt-[8px] transition-all font-[inherit]"
          onClick={(e) => { e.stopPropagation(); jump(); }}
        >
          SALTA!
        </button>
      </div>

    </div>
  );
}

