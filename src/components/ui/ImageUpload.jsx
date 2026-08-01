'use client';
import { useState, useRef } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { uploadFileToCloudinary } from '@/lib/services/fileUpload';

/**
 * Picks an image, uploads it, and shows what is currently set — the workspace
 * logo and the project avatar both go through here.
 *
 * @param {string} props.value URL of the image already stored.
 * @param {(url: string) => void} props.onChange Fires with the uploaded image's URL.
 * @param {(message: string) => void} props.onError Fires when the upload fails, with a message to show.
 * @param {string} props.label Caption above the control.
 * @param {boolean} props.showLabel Whether that caption is drawn.
 * @param {boolean} props.showHint Whether the size and format hint is drawn.
 * @param {'dark'|'light'} props.theme Which surface it sits on; onboarding is dark, settings is light.
 * @param {string} props.className Placement in the parent only.
 */
export default function ImageUpload({ value, onChange, onError, className = '', label = 'Завантажити логотип', showLabel = true, showHint = true, theme = 'dark' }) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  const isDark = theme === 'dark';
  const textColor = isDark ? 'text-white' : 'text-ink';
  const subTextColor = isDark ? 'text-white/40' : 'text-muted';
  const removeColor = isDark ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-500';
  const bgClass = isDark ? 'bg-[#2a2a2a] border-white/10 hover:border-white/30' : 'bg-canvas border-line hover:border-faint';
  const iconColor = isDark ? 'text-white/50' : 'text-muted';

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    setUploadError('');
    try {
      const { downloadUrl } = await uploadFileToCloudinary(file);
      onChange(downloadUrl);
    } catch (err) {
      console.error(err);
      const message = 'Помилка завантаження файлу.';
      if (onError) onError(message); else setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <button
        type="button"
        aria-label={label}
        className={`relative w-[64px] h-[64px] rounded-full overflow-hidden border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${bgClass}`}
        onClick={() => fileInputRef.current?.click()}
      >
        {isUploading ? (
          <Loader2 className={`w-6 h-6 animate-spin ${iconColor}`} />
        ) : value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Logo" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
              <Upload className="w-5 h-5 text-white" />
            </div>
          </>
        ) : (
          <Upload className={`w-6 h-6 ${iconColor}`} />
        )}
      </button>

      <div className="flex flex-col gap-1 justify-center">
        {showLabel && <span className={`text-[14px] font-medium ${textColor}`}>{label}</span>}
        {value ? (
          <button 
            onClick={() => onChange('')}
            className={`text-[12px] transition-colors text-left font-medium ${removeColor}`}
          >
            Видалити
          </button>
        ) : showHint ? (
          <span className={`text-[12px] ${subTextColor}`}>Рекомендовано 1:1 (PNG, JPG)</span>
        ) : null}
        {uploadError && (
          <span className="text-[12px] font-medium text-red-500">{uploadError}</span>
        )}
      </div>

      <input 
        type="file" 
        accept="image/*" 
        className="hidden" 
        ref={fileInputRef}
        onChange={handleFileChange}
      />
    </div>
  );
}
