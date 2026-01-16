/**
 * Utilities for /mu/ board: audio recording and music-related generation
 */

// Random song title generator
const ADJECTIVES = ['Silent', 'Dark', 'Eternal', 'Digital', 'Neon', 'Forgotten', 'Lush', 'Static', 'Velvet', 'Cold'];
const NOUNS = ['Echo', 'Rhythm', 'Void', 'Circuit', 'Memory', 'Ghost', 'Horizon', 'Structure', 'Entropy', 'Symphony'];
const VERBS = ['Waiting', 'Fading', 'Rising', 'Dancing', 'Dreaming', 'Crashing', 'Echoing', 'Breathing'];

export function generateRandomSongTitle(): string {
  const roll = Math.random();
  if (roll < 0.3) {
    return `${ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]} ${NOUNS[Math.floor(Math.random() * NOUNS.length)]}`;
  } else if (roll < 0.6) {
    return `${NOUNS[Math.floor(Math.random() * NOUNS.length)]} of ${ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]}`;
  } else {
    return `${VERBS[Math.floor(Math.random() * VERBS.length)]} ${NOUNS[Math.floor(Math.random() * NOUNS.length)]}`;
  }
}

// Media recording state
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];

export async function startAudioRecording(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  audioChunks = [];
  
  mediaRecorder.ondataavailable = (event) => {
    audioChunks.push(event.data);
  };
  
  mediaRecorder.start();
  return stream;
}

export async function stopAudioRecording(): Promise<Blob> {
  return new Promise((resolve) => {
    if (!mediaRecorder) return resolve(new Blob());
    
    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      resolve(audioBlob);
    };
    
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
  });
}
