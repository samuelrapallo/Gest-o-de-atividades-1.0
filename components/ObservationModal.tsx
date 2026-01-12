
import React, { useState, useEffect, useRef } from 'react';
import { MicrophoneIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/solid';
import { TaskStatus } from '../types';

interface ObservationModalProps {
  isOpen: boolean;
  type: TaskStatus;
  onClose: () => void;
  onSubmit: (observation: string) => void;
}

const ObservationModal: React.FC<ObservationModalProps> = ({ isOpen, type, onClose, onSubmit }) => {
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'pt-BR';
        
        recognition.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
          }
          if (finalTranscript) setText(prev => (prev ? prev + ' ' : '') + finalTranscript);
        };
        
        recognition.onend = () => setIsListening(false);
        recognition.onerror = (event: any) => {
          console.warn("Speech recognition error:", event.error);
          setIsListening(false);
        };
        
        recognitionRef.current = recognition;
      } catch (e) {
        console.error("Falha ao inicializar SpeechRecognition:", e);
      }
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }
    };
  }, [isOpen]);

  const toggleListening = () => {
    if (!recognitionRef.current) return alert("Seu navegador não suporta reconhecimento de voz.");
    
    try {
      if (isListening) {
        recognitionRef.current.stop();
      } else {
        setIsListening(true);
        recognitionRef.current.start();
      }
    } catch (e) {
      console.error("Erro ao alternar reconhecimento:", e);
      setIsListening(false);
      alert("Erro ao acessar o microfone. Verifique as permissões de áudio.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
        <div className="p-8 flex justify-between items-center border-b border-gray-100">
          <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase">
            {type === TaskStatus.COMPLETED ? 'Concluir Atividade' : 'Reprogramar Atividade'}
          </h3>
          <button onClick={onClose} className="p-2 bg-gray-50 rounded-full text-gray-400"><XMarkIcon className="h-5 w-5" /></button>
        </div>

        <div className="p-8 space-y-6">
          <div className="relative">
            <textarea
              className="w-full h-40 p-6 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-50 transition-all resize-none text-gray-700 font-medium text-sm"
              placeholder="Descreva as observações ou clique no microfone..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            
            <div className="absolute bottom-4 right-4 flex items-center gap-4">
              {isListening && (
                <div className="flex gap-1 h-4 items-center">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="w-1 bg-red-500 rounded-full animate-bounce" style={{ height: `${Math.random() * 80 + 20}%`, animationDelay: `${i * 0.1}s` }}></div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={toggleListening}
                className={`p-4 rounded-full shadow-xl transition-all ${isListening ? 'bg-red-500 text-white scale-110' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
              >
                <MicrophoneIcon className="h-6 w-6" />
              </button>
            </div>
          </div>
          
          {isListening && <p className="text-[9px] font-black text-red-500 uppercase tracking-widest text-center animate-pulse">Escutando áudio...</p>}
        </div>

        <div className="p-8 bg-gray-50/50 flex gap-4">
          <button onClick={onClose} className="flex-1 px-6 py-4 bg-white border border-gray-200 text-gray-500 rounded-xl font-bold hover:bg-gray-100 transition-all text-xs uppercase">Cancelar</button>
          <button onClick={() => onSubmit(text)} className="flex-1 px-6 py-4 bg-indigo-600 text-white rounded-xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 text-xs uppercase">
            <CheckIcon className="h-5 w-5" /> Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ObservationModal;
