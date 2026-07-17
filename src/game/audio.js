let audioContext;
let musicTimer;

const notes = [261.63, 329.63, 392, 523.25, 392, 329.63, 293.66, 392];

function tone(frequency, duration = 0.1, type = 'square', volume = 0.035, delay = 0) {
  if (!audioContext) return;
  const now = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

export function startMusic() {
  audioContext ??= new AudioContext();
  audioContext.resume();
  let step = 0;
  const playStep = () => {
    tone(notes[step % notes.length], 0.12, 'square', 0.018);
    if (step % 2 === 0) tone(notes[(step + 2) % notes.length] / 2, 0.18, 'triangle', 0.018);
    step += 1;
  };
  playStep();
  musicTimer = window.setInterval(playStep, 230);
}

export function stopMusic() {
  window.clearInterval(musicTimer);
  musicTimer = undefined;
}

export const sfx = {
  jump: () => { tone(420, 0.08, 'square', 0.04); tone(620, 0.08, 'square', 0.035, 0.06); },
  coin: () => { tone(880, 0.07, 'sine', 0.04); tone(1320, 0.1, 'sine', 0.03, 0.07); },
  feather: () => [0, 0.08, 0.16].forEach((delay, i) => tone([659, 880, 1174][i], 0.18, 'triangle', 0.045, delay)),
  hit: () => tone(120, 0.22, 'sawtooth', 0.05),
  sword: () => { tone(740, 0.06, 'sawtooth', 0.035); tone(330, 0.1, 'triangle', 0.025, 0.05); },
  checkpoint: () => { tone(523, 0.12, 'sine', 0.04); tone(784, 0.2, 'sine', 0.04, 0.12); },
  clear: () => [523, 659, 784, 1047].forEach((n, i) => tone(n, 0.4, 'triangle', 0.05, i * 0.12)),
};
