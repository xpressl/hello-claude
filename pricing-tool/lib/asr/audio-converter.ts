import ffmpeg from 'fluent-ffmpeg'

export async function convertToMP3(
  inputPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat('mp3')
      .audioCodec('libmp3lame')
      .audioChannels(1)  // Mono is fine for speech
      .audioFrequency(16000)  // 16kHz sufficient for speech
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .save(outputPath)
  })
}

export async function getAudioDuration(
  audioPath: string
): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) {
        reject(err)
      } else {
        resolve(metadata.format.duration || 0)
      }
    })
  })
}

export function isAudioFile(mimeType: string): boolean {
  return mimeType.startsWith('audio/')
}

export function getSupportedAudioFormats(): string[] {
  return [
    'audio/mpeg',      // MP3
    'audio/mp4',       // M4A
    'audio/wav',       // WAV
    'audio/x-wav',
    'audio/webm',      // WebM
    'audio/ogg',       // OGG
    'audio/flac'       // FLAC
  ]
}

export function estimateWhisperCost(durationSeconds: number): number {
  const minutes = durationSeconds / 60
  return minutes * 0.006
}
