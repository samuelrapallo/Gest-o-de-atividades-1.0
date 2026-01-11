
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
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'pt-BR';

      recognition.onresult = (event: any) => {
        if (!event || !event.results) return;
        
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          if (result && result.isFinal) {
            finalTranscript += result[0].transcript;
          }
        }
        if (finalTranscript) {
          setText(prev => (prev ? prev + ' ' : '') + finalTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isOpen]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Reconhecimento de voz não suportado neste navegador.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setIsListening(true);
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error(e);
        setIsListening(false);
      }
    }
  };

  if (!isOpen) return null;

  const isCompleted = type === TaskStatus.COMPLETED;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-900">
            {isCompleted ? 'Finalizar Atividade' : 'Reprogramar Atividade'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500">
            {isCompleted 
              ? 'Deseja adicionar alguma observação sobre a conclusão?' 
              : 'Informe o motivo da reprogramação ou nova data prevista.'}
          </p>
          
          <div className="relative">
            <textarea
              className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none resize-none text-gray-700"
              placeholder="Digite aqui ou use o microfone..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button
              type="button"
              onClick={toggleListening}
              className={`absolute bottom-3 right-3 p-2 rounded-full transition-all shadow-lg ${
                isListening 
                  ? 'bg-red-500 text-white animate-pulse' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
              title={isListening ? 'Parar Gravação' : 'Usar Microfone'}
            >
              <MicrophoneIcon className="h-5 w-5" />
            </button>
          </div>
          
          {isListening && (
            <div className="flex items-center gap-2 text-xs text-red-500 font-medium animate-pulse">
              <span className="h-2 w-2 bg-red-500 rounded-full"></span>
              Ouvindo sua voz...
            </div>
          )}
        </div>

        <div className="p-6 bg-gray-50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSubmit(text)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-white transition-all shadow-md active:scale-95 ${
              isCompleted ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            <CheckIcon className="h-5 w-5" />
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ObservationModal;
