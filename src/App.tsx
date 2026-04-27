import { useEffect, useRef, useState } from 'react';

let audioCtx: AudioContext | null = null;
let bgmBuffer: AudioBuffer | null = null;
let bgmSource: AudioBufferSourceNode | null = null;
let bgmGain: GainNode | null = null;

const generateBGM = (ctx: AudioContext) => {
  const sampleRate = ctx.sampleRate;
  const bpm = 140;
  const stepLen = (60 / bpm) / 2; // 8th notes
  
  // Nello Salterino Catchy Bassline (C minor pentatonic)
  const C3 = 130.81, Eb3 = 155.56, F3 = 174.61, G3 = 196.00, Bb3 = 233.08, C4 = 261.63, G2 = 98.00;
  
  const notemap = [
    C3, C3, C4, Eb3, F3, Eb3, C3, Bb3,
    C3, C3, G3, F3, Eb3, F3, Eb3, Bb3,
    C3, C3, C4, Eb3, F3, Eb3, C3, Bb3,
    G2, G2, G3, F3, Eb3, F3, Eb3, Bb3
  ];
  
  const totalLength = stepLen * notemap.length;
  const buffer = ctx.createBuffer(1, sampleRate * totalLength, sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < notemap.length; i++) {
    const freq = notemap[i];
    const startSample = Math.floor(i * stepLen * sampleRate);
    const endSample = Math.floor((i + 1) * stepLen * sampleRate);
    
    for (let j = startSample; j < endSample; j++) {
      const t = (j - startSample) / sampleRate;
      
      // Square wave
      let sample = Math.sin(2 * Math.PI * freq * t) > 0 ? 0.5 : -0.5;
      
      // Envelope: fast attack, quick decay
      const env = Math.exp(-t * 15); 
      
      data[j] = sample * env;
    }
  }
  
  return buffer;
};

const playBGM = () => {
  if (!audioCtx) return;
  if (bgmSource) return; // Already playing

  if (!bgmBuffer) {
    bgmBuffer = generateBGM(audioCtx);
  }

  bgmSource = audioCtx.createBufferSource();
  bgmSource.buffer = bgmBuffer;
  bgmSource.loop = true;

  bgmGain = audioCtx.createGain();
  bgmGain.gain.value = 0.03; // Basso volume

  bgmSource.connect(bgmGain);
  bgmGain.connect(audioCtx.destination);
  bgmSource.start();
};

const stopBGM = () => {
  if (bgmSource && bgmGain) {
    // Fade out
    bgmGain.gain.exponentialRampToValueAtTime(0.001, audioCtx!.currentTime + 0.5);
    setTimeout(() => {
      if (bgmSource) {
        bgmSource.stop();
        bgmSource.disconnect();
        bgmSource = null;
      }
    }, 500);
  }
};

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
const BASE_SPEED = 4.5;

type GameState = 'START' | 'PLAYING' | 'GAMEOVER';
type Character = 'nello' | 'pixie';

interface Player {
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

interface PowerUp {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'golden_bone';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [character, setCharacter] = useState<Character>('nello');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  // Variabili mutabili per il loop senza causare re-render
  const stateRef = useRef({
    gameState: 'START' as GameState,
    character: 'nello' as Character,
    score: 0,
    dog: { x: 80, y: 300, w: 40, h: 40, vy: 0 } as Player,
    obstacles: [] as Obstacle[],
    sausages: [] as Sausage[],
    powerUps: [] as PowerUp[],
    frames: 0,
    nextSpawn: 60,
    nextSausageSpawn: 90,
    nextPowerUpSpawn: 400,
    invincibleFrames: 0,
    bgOffset: 0,
    cloudOffset: 0,
    particles: [] as Particle[],
  });

  const animationRef = useRef<number>(null);

  // Sincronizza lo stato React con lo stato mutabile per gli eventi
  useEffect(() => {
    stateRef.current.gameState = gameState;
    stateRef.current.character = character;
  }, [gameState, character]);

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
      s.powerUps = [];
      s.score = 0;
      s.frames = 0;
      s.nextSpawn = 60;
      s.nextSausageSpawn = 90;
      s.nextPowerUpSpawn = 300 + Math.random() * 300;
      s.invincibleFrames = 0;
      s.bgOffset = 0;
      s.cloudOffset = 0;
      s.particles = [];
      setScore(0);
      setGameState('PLAYING');
      playBGM();
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

    const drawDog = (dog: Player) => {
      const isInvincible = stateRef.current.invincibleFrames > 0;
      // Se invincibile, lampeggia d'oro
      const bodyColor = isInvincible && (Math.floor(stateRef.current.frames / 4) % 2 === 0) ? '#f1c40f' : '#111';
      const headColor = isInvincible && (Math.floor(stateRef.current.frames / 4) % 2 === 0) ? '#f39c12' : '#111';

      // Corpo principale nero scuro
      ctx.fillStyle = bodyColor; 
      ctx.fillRect(dog.x, dog.y + 15, 30, 20); // Corpo
      
      // Testa
      ctx.fillStyle = headColor;
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

    const drawCat = (cat: Player) => {
      const isInvincible = stateRef.current.invincibleFrames > 0;
      // Colore tabby / beige
      const bodyColor = isInvincible && (Math.floor(stateRef.current.frames / 4) % 2 === 0) ? '#f1c40f' : '#bfa68d';
      const stripeColor = '#5c4e40';
      
      // Corpo
      ctx.fillStyle = bodyColor;
      ctx.fillRect(cat.x, cat.y + 16, 28, 16);
      
      // Strisce sul corpo
      ctx.fillStyle = stripeColor;
      ctx.fillRect(cat.x + 4, cat.y + 16, 4, 16);
      ctx.fillRect(cat.x + 12, cat.y + 16, 4, 16);
      ctx.fillRect(cat.x + 20, cat.y + 16, 4, 16);

      // Testa
      ctx.fillStyle = bodyColor;
      ctx.fillRect(cat.x + 20, cat.y + 8, 18, 16);
      
      // Orecchie a punta
      ctx.fillRect(cat.x + 22, cat.y + 2, 6, 6);
      ctx.fillRect(cat.x + 32, cat.y + 2, 6, 6);
      
      // Interno orecchie
      ctx.fillStyle = '#e5a5a5';
      ctx.fillRect(cat.x + 24, cat.y + 4, 2, 4);
      ctx.fillRect(cat.x + 34, cat.y + 4, 2, 4);

      // Occhi (verdi/gialli, grandi)
      ctx.fillStyle = '#000';
      ctx.fillRect(cat.x + 24, cat.y + 12, 4, 4);
      ctx.fillRect(cat.x + 32, cat.y + 12, 4, 4);
      ctx.fillStyle = '#b5e550';
      ctx.fillRect(cat.x + 25, cat.y + 13, 2, 2);
      ctx.fillRect(cat.x + 33, cat.y + 13, 2, 2);
      
      // Nasino rosa
      ctx.fillStyle = '#e5a5a5';
      ctx.fillRect(cat.x + 30, cat.y + 18, 2, 2);

      // Muso chiaro
      ctx.fillStyle = '#e8d5c4';
      ctx.fillRect(cat.x + 28, cat.y + 20, 6, 4);

      // Baffi
      ctx.fillStyle = '#fff';
      ctx.fillRect(cat.x + 34, cat.y + 20, 6, 1);
      ctx.fillRect(cat.x + 34, cat.y + 22, 6, 1);

      // Coda
      ctx.fillStyle = bodyColor;
      ctx.fillRect(cat.x - 12, cat.y + 12, 12, 4);
      ctx.fillRect(cat.x - 12, cat.y + 6, 4, 6); // coda alzata

      // Zampe
      const legY = cat.y + 32;
      ctx.fillStyle = bodyColor;
      
      if (stateRef.current.gameState === 'PLAYING' && cat.y >= 300) {
        // Animazione corsa
        if (Math.floor(stateRef.current.frames / 4) % 2 === 0) {
          ctx.fillRect(cat.x + 4, legY, 6, 8);
          ctx.fillRect(cat.x + 20, legY, 6, 8);
        } else {
          ctx.fillRect(cat.x, legY - 2, 6, 8);
          ctx.fillRect(cat.x + 16, legY - 2, 6, 8);
        }
      } else if (cat.y < 300) {
         // Salto
         ctx.fillRect(cat.x, legY - 4, 8, 6);
         ctx.fillRect(cat.x + 20, legY - 4, 8, 6);
      } else {
         // Ferma
         ctx.fillRect(cat.x + 4, legY, 6, 8);
         ctx.fillRect(cat.x + 20, legY, 6, 8);
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

    const drawPowerUp = (pu: PowerUp) => {
      // Osso d'Oro
      ctx.fillStyle = '#f1c40f'; // Giallo oro
      ctx.fillRect(pu.x + 6, pu.y + 6, pu.w - 12, pu.h - 12);
      
      // Nodi dell'osso
      ctx.fillRect(pu.x, pu.y, 8, 8);
      ctx.fillRect(pu.x, pu.y + pu.h - 8, 8, 8);
      ctx.fillRect(pu.x + pu.w - 8, pu.y, 8, 8);
      ctx.fillRect(pu.x + pu.w - 8, pu.y + pu.h - 8, 8, 8);

      // Stella luccicante (animata)
      if (Math.floor(stateRef.current.frames / 6) % 2 === 0) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(pu.x - 4, pu.y + pu.h/2 - 2, 4, 4);
        ctx.fillRect(pu.x + pu.w, pu.y + pu.h/2 - 2, 4, 4);
        ctx.fillRect(pu.x + pu.w/2 - 2, pu.y - 4, 4, 4);
        ctx.fillRect(pu.x + pu.w/2 - 2, pu.y + pu.h, 4, 4);
      }
    };

    const drawBackground = (bgOffset: number, cloudOffset: number) => {
      // Sfondo/Cielo
      ctx.fillStyle = '#70c5ce';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Nuvola a pixel
      ctx.fillStyle = '#FFFFFF';
      ctx.globalAlpha = 0.8;
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
      for (let i = -40; i < CANVAS_WIDTH + 40; i += 40) {
        ctx.fillRect(i - bgOffset + 36, 340, 4, 60);
      }
    };

    const loop = () => {
      const s = stateRef.current;
      
      // Calcolo velocità dinamica
      const currentSpeed = s.gameState === 'PLAYING' ? Math.min(12, BASE_SPEED + s.score / 200) : BASE_SPEED;
      
      if (s.gameState === 'PLAYING') {
        s.bgOffset = (s.bgOffset + currentSpeed) % 40;
        s.cloudOffset = (s.cloudOffset + 0.5) % (CANVAS_WIDTH + 200);
      }
      
      // Clear
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      drawBackground(s.bgOffset, s.cloudOffset);

      if (s.gameState === 'PLAYING') {
        // Decrementa frames invincibilità
        if (s.invincibleFrames > 0) {
          s.invincibleFrames--;
          // Genera particelle
          if (s.frames % 2 === 0) {
            s.particles.push({
              x: s.dog.x + Math.random() * s.dog.w,
              y: s.dog.y + Math.random() * s.dog.h,
              vx: (Math.random() - 0.5) * 4 - currentSpeed * 0.5,
              vy: (Math.random() - 1) * 3,
              life: 1.0,
              color: ['#f1c40f', '#f39c12', '#fff', '#e74c3c'][Math.floor(Math.random() * 4)]
            });
          }
        }

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
        
        // Spawn rates scalano con la velocità (più veloci = spawn più frequenti)
        const spawnScale = BASE_SPEED / currentSpeed;
        
        if (s.frames > s.nextSpawn) {
          s.obstacles.push({
            x: CANVAS_WIDTH,
            y: 300,
            w: 30, // Larghezza ostacolo
            h: 40 + Math.random() * 30 // Altezza casuale
          });
          s.nextSpawn = s.frames + (60 + Math.random() * 60) * spawnScale;
        }

        // Generazione wurstel (in aria)
        if (s.frames > s.nextSausageSpawn) {
          s.sausages.push({
            x: CANVAS_WIDTH,
            y: 160 + Math.random() * 80, // Altezza da salto
            w: 32,
            h: 12
          });
          s.nextSausageSpawn = s.frames + (50 + Math.random() * 80) * spawnScale;
        }

        // Generazione PowerUp (molto rari)
        if (s.frames > s.nextPowerUpSpawn) {
          s.powerUps.push({
            x: CANVAS_WIDTH,
            y: 200 + Math.random() * 60,
            w: 30,
            h: 20,
            type: 'golden_bone'
          });
          s.nextPowerUpSpawn = s.frames + 600 + Math.random() * 600; // Uno ogni tanto
        }

        // Hitbox cane
        const dogHitbox = { x: s.dog.x + 5, y: s.dog.y + 10, w: 35, h: 30 };

        // Logica Wurstels
        for (let i = s.sausages.length - 1; i >= 0; i--) {
          const saus = s.sausages[i];
          saus.x -= currentSpeed;
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

        // Logica PowerUp
        for (let i = s.powerUps.length - 1; i >= 0; i--) {
          const pu = s.powerUps[i];
          pu.x -= currentSpeed;
          drawPowerUp(pu);
          
          const puHitbox = { x: pu.x, y: pu.y, w: pu.w, h: pu.h };
          
          if (
            dogHitbox.x < puHitbox.x + puHitbox.w &&
            dogHitbox.x + dogHitbox.w > puHitbox.x &&
            dogHitbox.y < puHitbox.y + puHitbox.h &&
            dogHitbox.y + dogHitbox.h > puHitbox.y
          ) {
            playSound('jump'); // Suono simile
            s.invincibleFrames = 300; // Circa 5 secondi di invincibilità
            s.score += 100;
            setScore(s.score);
            s.powerUps.splice(i, 1);
            continue;
          }

          if (pu.x + pu.w < 0) {
            s.powerUps.splice(i, 1);
          }
        }

        // Logica Ostacoli
        for (let i = s.obstacles.length - 1; i >= 0; i--) {
          const obs = s.obstacles[i];
          obs.x -= currentSpeed;

          drawObstacle({ ...obs, y: 340 - obs.h }); // Disegna partendo da terra

          const obsHitbox = { x: obs.x, y: 340 - obs.h, w: obs.w, h: obs.h };

          if (
            s.invincibleFrames <= 0 && // Ignora collisione se invincibile
            dogHitbox.x < obsHitbox.x + obsHitbox.w &&
            dogHitbox.x + dogHitbox.w > obsHitbox.x &&
            dogHitbox.y < obsHitbox.y + obsHitbox.h &&
            dogHitbox.y + dogHitbox.h > obsHitbox.y
          ) {
            // GameOver
            if (s.gameState !== 'GAMEOVER') {
              playSound('hit');
              stopBGM();
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
        // Logica Scia Particelle
        for (let i = s.particles.length - 1; i >= 0; i--) {
          const p = s.particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.05;
          if (p.life <= 0) s.particles.splice(i, 1);
        }

      } else {
        // Disegna da fermo se non stiamo giocando
        s.powerUps.forEach(pu => drawPowerUp(pu));
        s.sausages.forEach(saus => drawSausage(saus));
        s.obstacles.forEach(obs => drawObstacle({ ...obs, y: 340 - obs.h }));
      }

      // Disegna le particelle dell'effetto scia
      s.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillRect(p.x, p.y, 6, 6);
      });
      ctx.globalAlpha = 1.0;

      if (s.character === 'pixie') {
        drawCat(s.dog);
      } else {
        drawDog(s.dog);
      }

      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      stopBGM();
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
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20 text-white text-center">
            <h1 className="text-3xl lg:text-4xl mb-2 text-white" style={{ textShadow: '4px 4px 0 #000' }}>NELLO SALTERINO</h1>
            <p className="mt-2 text-sm mb-6 text-[#70c5ce]" style={{ textShadow: '2px 2px 0 #000' }}>SCEGLI IL TUO PERSONAGGIO</p>
            
            <div className="flex gap-4 sm:gap-12 mb-4" onClick={(e) => e.stopPropagation()}>
              <div 
                className={`p-4 cursor-pointer transition-all duration-300 flex flex-col items-center ${character === 'nello' ? 'scale-110 drop-shadow-[0_0_15px_rgba(241,196,15,0.8)]' : 'opacity-50 hover:opacity-100 hover:scale-105'}`}
                onClick={() => setCharacter('nello')}
              >
                <div className={`w-28 h-28 sm:w-32 sm:h-32 mb-2 ${character === 'nello' ? 'animate-bounce' : ''}`}>
                  <svg viewBox="0 0 16 16" width="100%" height="100%" style={{imageRendering: 'pixelated'}}>
                    <rect x="4" y="3" width="8" height="10" fill="#111" />
                    <rect x="3" y="10" width="10" height="4" fill="#4a3b32" />
                    <rect x="7" y="10" width="2" height="2" fill="#000" />
                    <rect x="5" y="7" width="2" height="2" fill="#fff" />
                    <rect x="6" y="8" width="1" height="1" fill="#000" />
                    <rect x="9" y="7" width="2" height="2" fill="#fff" />
                    <rect x="9" y="8" width="1" height="1" fill="#000" />
                    <rect x="3" y="3" width="2" height="5" fill="#111" />
                    <rect x="11" y="3" width="2" height="5" fill="#111" />
                  </svg>
                </div>
                <h3 className="text-4xl sm:text-5xl uppercase font-bold tracking-wider" style={{
                  background: 'linear-gradient(to bottom, #FFF129 0%, #F57200 48%, #E50000 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  WebkitTextStroke: '2px #000',
                  filter: 'drop-shadow(4px 4px 0px #000)'
                }}>
                  NELLO
                </h3>
              </div>
              <div 
                className={`p-4 cursor-pointer transition-all duration-300 flex flex-col items-center ${character === 'pixie' ? 'scale-110 drop-shadow-[0_0_15px_rgba(241,196,15,0.8)]' : 'opacity-50 hover:opacity-100 hover:scale-105'}`}
                onClick={() => setCharacter('pixie')}
              >
                <div className={`w-28 h-28 sm:w-32 sm:h-32 mb-2 ${character === 'pixie' ? 'animate-bounce' : ''}`}>
                  <svg viewBox="0 0 16 16" width="100%" height="100%" style={{imageRendering: 'pixelated'}}>
                    <rect x="2" y="1" width="4" height="4" fill="#bfa68d" />
                    <rect x="3" y="2" width="2" height="3" fill="#e5a5a5" />
                    <rect x="10" y="1" width="4" height="4" fill="#bfa68d" />
                    <rect x="11" y="2" width="2" height="3" fill="#e5a5a5" />
                    <rect x="2" y="5" width="12" height="9" fill="#bfa68d" />
                    <rect x="4" y="5" width="2" height="3" fill="#5c4e40" />
                    <rect x="7" y="5" width="2" height="3" fill="#5c4e40" />
                    <rect x="10" y="5" width="2" height="3" fill="#5c4e40" />
                    <rect x="4" y="8" width="3" height="3" fill="#000" />
                    <rect x="4" y="9" width="1" height="1" fill="#b5e550" />
                    <rect x="9" y="8" width="3" height="3" fill="#000" />
                    <rect x="11" y="9" width="1" height="1" fill="#b5e550" />
                    <rect x="6" y="11" width="4" height="3" fill="#e8d5c4" />
                    <rect x="7" y="11" width="2" height="1" fill="#e5a5a5" />
                    <rect x="0" y="11" width="3" height="1" fill="#fff" />
                    <rect x="0" y="13" width="3" height="1" fill="#fff" />
                    <rect x="13" y="11" width="3" height="1" fill="#fff" />
                    <rect x="13" y="13" width="3" height="1" fill="#fff" />
                  </svg>
                </div>
                <h3 className="text-4xl sm:text-5xl uppercase font-bold tracking-wider" style={{
                  background: 'linear-gradient(to bottom, #FFF129 0%, #F57200 48%, #E50000 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  WebkitTextStroke: '2px #000',
                  filter: 'drop-shadow(4px 4px 0px #000)'
                }}>
                  PIXIE
                </h3>
              </div>
            </div>

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

