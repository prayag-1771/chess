'use client'

import { useCallback, useRef, useEffect } from 'react'

const SOUND_URLS = {
  pickup: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-self.mp3',
  place: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-self.mp3',
  capture: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/capture.mp3',
  check: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/check.mp3',
  castle: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/castle.mp3',
  gameOver: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-end.mp3',
  promote: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/promote.mp3',
}

export type SoundType = keyof typeof SOUND_URLS

export const useSound = () => {
  const audios = useRef<{ [key in SoundType]?: HTMLAudioElement }>({})

  useEffect(() => {
    Object.entries(SOUND_URLS).forEach(([key, url]) => {
      const audio = new Audio(url)
      audio.preload = 'auto'
      audios.current[key as SoundType] = audio
    })
  }, [])

  const playSound = useCallback((type: SoundType) => {
    const audio = audios.current[type]
    if (audio) {
      audio.currentTime = 0
      audio.play().catch((e) => console.log('Audio play prevented:', e))
    }
  }, [])

  return playSound
}
