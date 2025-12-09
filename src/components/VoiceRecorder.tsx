import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Mic, Square, Send, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import decode from 'audio-decode';
import WavEncoder from 'wav-encoder';

interface VoiceRecorderProps {
  patientId: string;
  onTranscriptionComplete: (text: string) => void;
  onCancel: () => void;
}

export function VoiceRecorder({ patientId, onTranscriptionComplete, onCancel }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [remainingToday, setRemainingToday] = useState<number | null>(null);
  const [audioFormat, setAudioFormat] = useState<'wav'>('wav');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const MAX_RECORDING_TIME = 90; // 90 seconds

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        
        // Ensure we have audio data
        if (chunksRef.current.length === 0) {
          toast({
            title: 'Erro na gravação',
            description: 'Nenhum áudio foi gravado. Tente novamente.',
            variant: 'destructive',
          });
          onCancel();
          return;
        }
        
        const blob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
        console.log('Audio blob created:', blob.size, 'bytes');
        
        // Small delay to ensure blob is fully formed
        await new Promise(resolve => setTimeout(resolve, 100));
        
        await convertAndTranscribe(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      if ('vibrate' in navigator) (navigator as any).vibrate?.(50);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const next = prev + 1;
          if (next >= MAX_RECORDING_TIME) stopRecording();
          return next;
        });
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: 'Erro ao acessar microfone',
        description: 'Verifique se você concedeu permissão para usar o microfone.',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      if (timerRef.current) clearInterval(timerRef.current);
      
      // Request final data before stopping
      mediaRecorderRef.current.requestData();
      mediaRecorderRef.current.stop();
      
      setIsRecording(false);
      if ('vibrate' in navigator) (navigator as any).vibrate?.(50);
    }
  };

  const convertAndTranscribe = async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const wavBase64 = await webmToWavBase64(blob);
      if (!wavBase64) {
        toast({
          title: 'Erro ao processar áudio',
          description: 'Não foi possível converter o áudio. Tente novamente.',
          variant: 'destructive',
        });
        setIsTranscribing(false);
        onCancel();
        return;
      }
      
      await transcribeAudio(wavBase64);
    } catch (error: any) {
      console.error('Conversion error:', error);
      toast({
        title: 'Erro ao processar áudio',
        description: 'Não foi possível converter o áudio. Tente novamente.',
        variant: 'destructive',
      });
      setIsTranscribing(false);
      onCancel();
    }
  };

  const transcribeAudio = async (wavBase64: string) => {
    setIsTranscribing(true);
    
    try {
      // Call transcription edge function
      const { data, error } = await supabase.functions.invoke('voice-transcription', {
        body: {
          audio: wavBase64,
          mimeType: 'audio/wav',
          patientId: patientId
        }
      });

      if (error) {
        const status = (error as any)?.status ?? (error as any)?.context?.status;
        const message = (error as any)?.message || 'Falha na transcrição.';
        console.error('Transcription function error:', { status, message, error });

        if (status === 429) {
          toast({ title: 'Muitas solicitações', description: 'Limite de requisições excedido. Tente novamente em instantes.', variant: 'destructive' });
        } else if (status === 402) {
          toast({ title: 'Créditos insuficientes', description: 'Adicione créditos ao workspace do Lovable AI.', variant: 'destructive' });
        } else if (status === 413) {
          toast({ title: 'Áudio muito grande', description: 'Envie um arquivo de até 10MB ou grave por menos tempo.', variant: 'destructive' });
        } else if (status === 400) {
          toast({ title: 'Áudio inválido', description: 'O áudio enviado parece inválido ou muito curto.', variant: 'destructive' });
        }

        // Propagate for catch to handle cancel + state
        const err: any = new Error(message);
        err.status = status;
        throw err;
      }

      if (data?.error) {
        console.error('Transcription function returned error:', data);
        toast({ title: 'Erro na transcrição', description: data.error || 'Falha ao transcrever.', variant: 'destructive' });
        onCancel();
        return;
      }

      if (data.limitReached) {
        toast({ title: 'Limite diário atingido', description: data.message, variant: 'destructive' });
        onCancel();
        return;
      }

      setTranscription(data.text || '');
      toast({ title: 'Transcrição concluída' });

    } catch (error: any) {
      const status = error?.status ?? error?.context?.status;
      console.error('Transcription error:', { status, error });

      let description = error?.message || 'Não foi possível transcrever o áudio. Tente novamente.';
      if (status === 429) description = 'Limite de requisições excedido. Tente novamente em instantes.';
      else if (status === 402) description = 'Créditos insuficientes no Lovable AI. Adicione créditos ao workspace.';
      else if (status === 413) description = 'Áudio muito grande. Envie um arquivo até 10MB ou grave por menos tempo.';
      else if (status === 400) description = 'Áudio inválido ou muito curto. Grave novamente.';

      toast({ title: 'Erro na transcrição', description, variant: 'destructive' });
      onCancel();
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSend = () => {
    if (transcription.trim()) {
      onTranscriptionComplete(transcription.trim());
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isTranscribing) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Transcrevendo áudio...</p>
          <p className="text-xs text-muted-foreground">
            Duração: {formatTime(recordingTime)}
          </p>
        </div>
      </Card>
    );
  }

  if (transcription) {
    return (
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Transcrição</p>
            <p className="text-xs text-muted-foreground">
              {remainingToday !== null && `${remainingToday} mensagens restantes hoje`}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <Textarea
          value={transcription}
          onChange={(e) => setTranscription(e.target.value)}
          placeholder="Edite a transcrição se necessário..."
          rows={4}
          className="resize-none"
        />
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSend} className="flex-1">
            <Send className="h-4 w-4 mr-2" />
            Enviar
          </Button>
        </div>
      </Card>
    );
  }

  if (isRecording) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75" />
            <div className="relative bg-red-500 rounded-full p-4">
              <Mic className="h-6 w-6 text-white" />
            </div>
          </div>
          
          <div className="text-center">
            <p className="text-2xl font-bold text-red-500">
              {formatTime(recordingTime)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Máx: {formatTime(MAX_RECORDING_TIME)}
            </p>
          </div>

          <div className="flex gap-2 mt-2">
            <Button variant="outline" onClick={onCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={stopRecording} variant="destructive">
              <Square className="h-4 w-4 mr-2" />
              Parar
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-muted-foreground text-center">
          Segure o botão para gravar (máx. 90 segundos)
        </p>
        <Button
          size="lg"
          onClick={startRecording}
          className="w-full sm:w-auto"
        >
          <Mic className="h-5 w-5 mr-2" />
          Começar Gravação
        </Button>
      </div>
    </Card>
  );
}

// ===== Helper Functions =====

async function webmToWavBase64(webmBlob: Blob): Promise<string | null> {
  try {
    console.log('Converting webm to wav, blob size:', webmBlob.size);
    const arrayBuffer = await webmBlob.arrayBuffer();
    console.log('ArrayBuffer size:', arrayBuffer.byteLength);

    // Try using Web Audio API directly for better compatibility
    const audioContext = new AudioContext();
    let audioBuffer: AudioBuffer;
    
    try {
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      console.log('Audio decoded successfully:', {
        duration: audioBuffer.duration,
        channels: audioBuffer.numberOfChannels,
        sampleRate: audioBuffer.sampleRate
      });
    } catch (decodeError) {
      console.error('Web Audio API decode failed, trying audio-decode:', decodeError);
      // Fallback to audio-decode
      audioBuffer = await decode(arrayBuffer);
    }

    // 2) Downmix to MONO
    const mono = await downmixToMono(audioBuffer);

    // 3) Resample to 16000 Hz
    const resampled = await resampleAudioBuffer(mono, 16000);

    // 4) WAV PCM encoding
    const wavBuffer = await WavEncoder.encode({
      sampleRate: resampled.sampleRate,
      channelData: [resampled.getChannelData(0)]
    });

    console.log('WAV encoded, size:', wavBuffer.byteLength);

    // 5) Base64 WITHOUT data URI prefix
    const base64 = arrayBufferToBase64(wavBuffer);
    return base64;
  } catch (error) {
    console.error('Error converting to WAV:', error);
    return null;
  }
}

function downmixToMono(input: AudioBuffer): Promise<AudioBuffer> {
  if (input.numberOfChannels === 1) return Promise.resolve(input);
  
  const ctx = new OfflineAudioContext(1, input.length, input.sampleRate);
  const source = ctx.createBufferSource();
  source.buffer = input;
  const merger = ctx.createChannelMerger(1);
  const gainL = ctx.createGain();
  const gainR = ctx.createGain();
  gainL.gain.value = 0.5;
  gainR.gain.value = 0.5;
  const splitter = ctx.createChannelSplitter(2);
  source.connect(splitter);
  splitter.connect(gainL, 0);
  splitter.connect(gainR, 1);
  gainL.connect(merger, 0, 0);
  gainR.connect(merger, 0, 0);
  merger.connect(ctx.destination);
  source.start(0);
  return ctx.startRendering();
}

async function resampleAudioBuffer(input: AudioBuffer, targetRate: number): Promise<AudioBuffer> {
  if (input.sampleRate === targetRate) return input;
  
  const duration = input.duration;
  const frameCount = Math.ceil(duration * targetRate);
  const ctx = new OfflineAudioContext(1, frameCount, targetRate);
  const src = ctx.createBufferSource();
  src.buffer = input;
  src.connect(ctx.destination);
  src.start(0);
  const out = await ctx.startRendering();
  return out;
}

function arrayBufferToBase64(ab: ArrayBuffer): string {
  const bytes = new Uint8Array(ab);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
