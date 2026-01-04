/**
 * Patient Pre-Session Materials Component
 * Ermöglicht Patienten, Notizen, Skizzen, Audio/Video vor Sitzungen hochzuladen
 * DSGVO-konform: Verschlüsselte Speicherung, explizite Freigabe an Therapeut
 */

import { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Image, Mic, Video, Trash2, Share2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../api/client';
import { extractTextFromImageFile } from '../utils/ocr';
import { logger } from '../utils/logger';

interface PatientMaterial {
  id: string;
  materialType: 'note' | 'sketch' | 'audio' | 'video' | 'document';
  fileSizeBytes?: number;
  fileMimeType?: string;
  sharedWithTherapist: boolean;
  createdAt: string;
  appointmentId?: string;
}

export default function PatientMaterials() {
  const [materials, setMaterials] = useState<PatientMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [ocrLoading, setOcrLoading] = useState(false);
  
  // Modal States
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const noteTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  
  // File Upload States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<'sketch' | 'audio' | 'video' | 'document' | null>(null);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadMaterials();
  }, []);

  useEffect(() => {
    if (!showNoteModal) return;
    // A11y: Fokus in Modal + ESC schließen + Scroll lock
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const t = window.setTimeout(() => noteTextareaRef.current?.focus(), 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNoteModal(false);
        setNoteContent('');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [showNoteModal]);

  const loadMaterials = async () => {
    try {
      const response = await apiClient.get('/patient-materials');
      setMaterials(response.data.materials);
    } catch (error: any) {
      logger.error('PatientMaterials: Error loading materials', error);
      toast.error('Fehler beim Laden der Materialien');
    } finally {
      setLoading(false);
    }
  };

  // DSGVO-SAFE: Notiz hochladen
  const handleUploadNote = async () => {
    if (!noteContent.trim()) {
      toast.error('Bitte geben Sie eine Notiz ein');
      return;
    }

    setUploading(true);
    try {
      await apiClient.post('/patient-materials', {
        materialType: 'note',
        content: noteContent
      });

      toast.success('Notiz erfolgreich gespeichert');
      setNoteContent('');
      setShowNoteModal(false);
      await loadMaterials();
    } catch (error: any) {
      logger.error('PatientMaterials: Error uploading note', error);
      toast.error('Fehler beim Speichern der Notiz');
    } finally {
      setUploading(false);
    }
  };

  // DSGVO-SAFE: Datei hochladen (verschlüsselt)
  const handleUploadFile = async () => {
    if (!selectedFile || !uploadType) {
      toast.error('Bitte wählen Sie eine Datei aus');
      return;
    }

    // File Size Validation (100MB limit)
    if (selectedFile.size > 100 * 1024 * 1024) {
      toast.error('Datei zu groß (max. 100MB)');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    uploadAbortControllerRef.current?.abort();
    uploadAbortControllerRef.current = new AbortController();
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('materialType', uploadType);

    try {
      await apiClient.post('/patient-materials', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        signal: uploadAbortControllerRef.current.signal,
        onUploadProgress: (event: any) => {
          const total = event?.total;
          const loaded = event?.loaded;
          if (typeof total === 'number' && total > 0 && typeof loaded === 'number') {
            setUploadProgress(Math.min(100, Math.round((loaded / total) * 100)));
          }
        },
      });

      toast.success('Datei erfolgreich hochgeladen');
      setSelectedFile(null);
      setUploadType(null);
      await loadMaterials();
    } catch (error: any) {
      logger.error('PatientMaterials: Error uploading file', error);
      if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') {
        toast('Upload abgebrochen', { icon: 'ℹ️' });
      } else {
        toast.error(error.response?.data?.error || 'Fehler beim Hochladen');
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
      uploadAbortControllerRef.current = null;
    }
  };

  const handleCancelUpload = () => {
    if (uploadAbortControllerRef.current) {
      uploadAbortControllerRef.current.abort();
    }
  };

  const handleOcrFromSelectedImage = async () => {
    if (!selectedFile || !uploadType) {
      return;
    }
    if (!selectedFile.type.startsWith('image/')) {
      toast.error('OCR ist nur für Bilder verfügbar');
      return;
    }

    setOcrLoading(true);
    setShowNoteModal(true);
    setNoteContent('');
    try {
      const text = await extractTextFromImageFile(selectedFile);
      setNoteContent(text || '');
      if (!text) {
        toast('Kein Text erkannt (lokal)', { icon: 'ℹ️' });
      } else {
        toast.success('Text lokal erkannt');
      }
    } catch (error: any) {
      logger.error('PatientMaterials: OCR error', error);
      toast.error('OCR fehlgeschlagen');
    } finally {
      setOcrLoading(false);
    }
  };

  // Teile Material mit Therapeut
  const handleShareWithTherapist = async (materialId: string) => {
    try {
      await apiClient.patch(`/patient-materials/${materialId}/share`);
      toast.success('Mit Therapeut geteilt');
      await loadMaterials();
    } catch (error: any) {
      logger.error('PatientMaterials: Error sharing material', error);
      toast.error('Fehler beim Teilen');
    }
  };

  // Lösche Material (DSGVO Art. 17 - Recht auf Löschung)
  const handleDeleteMaterial = async (materialId: string) => {
    if (!confirm('Möchten Sie dieses Material wirklich löschen?')) {
      return;
    }

    try {
      await apiClient.delete(`/patient-materials/${materialId}`);
      toast.success('Material gelöscht');
      await loadMaterials();
    } catch (error: any) {
      logger.error('PatientMaterials: Error deleting material', error);
      toast.error('Fehler beim Löschen');
    }
  };

  // Download Material
  const handleDownloadMaterial = async (materialId: string) => {
    try {
      const response = await apiClient.get(`/patient-materials/${materialId}`, {
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `material-${materialId}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error: any) {
      logger.error('PatientMaterials: Error downloading material', error);
      toast.error('Fehler beim Herunterladen');
    }
  };

  const getMaterialIcon = (type: string) => {
    switch (type) {
      case 'note': return <FileText className="w-5 h-5" />;
      case 'sketch': return <Image className="w-5 h-5" />;
      case 'audio': return <Mic className="w-5 h-5" />;
      case 'video': return <Video className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Meine Vorbereitungsmaterialien
          </h1>
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowNoteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <FileText className="w-4 h-4" />
              Notiz erstellen
            </button>
            
            <div className="relative">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept="image/*,audio/*,video/*,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedFile(file);
                    // Auto-detect type
                    if (file.type.startsWith('image/')) setUploadType('sketch');
                    else if (file.type.startsWith('audio/')) setUploadType('audio');
                    else if (file.type.startsWith('video/')) setUploadType('video');
                    else setUploadType('document');
                  }
                }}
              />
              <label
                htmlFor="file-upload"
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Datei hochladen
              </label>
            </div>
          </div>
        </div>

        {/* DSGVO-Hinweis */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>🔒 Datenschutz:</strong> Alle hochgeladenen Materialien werden verschlüsselt gespeichert.
            Sie können jederzeit entscheiden, welche Materialien Sie mit Ihrem Therapeuten teilen möchten.
          </p>
        </div>

        {/* File Upload Preview */}
        {selectedFile && uploadType && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Bereit zum Hochladen:</p>
                <p className="text-sm text-gray-600">
                  {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setUploadType(null);
                  }}
                  disabled={uploading}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleUploadFile}
                  disabled={uploading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploading ? 'Lädt hoch...' : 'Hochladen'}
                </button>
                {selectedFile.type.startsWith('image/') && (
                  <button
                    onClick={handleOcrFromSelectedImage}
                    disabled={uploading || ocrLoading}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
                  >
                    {ocrLoading ? 'OCR läuft...' : 'Text erkennen (lokal)'}
                  </button>
                )}
                {uploading && (
                  <button
                    onClick={handleCancelUpload}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Upload stoppen
                  </button>
                )}
              </div>
            </div>

            {uploading && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                  <span>Upload läuft</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-blue-600"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Materials List */}
        {materials.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p>Noch keine Materialien vorhanden</p>
            <p className="text-sm">Erstellen Sie eine Notiz oder laden Sie eine Datei hoch</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {materials.map((material) => (
              <div
                key={material.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white rounded-lg">
                    {getMaterialIcon(material.materialType)}
                  </div>
                  
                  <div>
                    <p className="font-medium text-gray-900 capitalize">
                      {material.materialType === 'note' ? 'Notiz' : 
                       material.materialType === 'sketch' ? 'Skizze' :
                       material.materialType === 'audio' ? 'Audioaufnahme' :
                       material.materialType === 'video' ? 'Videoaufnahme' : 'Dokument'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {new Date(material.createdAt).toLocaleDateString('de-DE')}
                      {material.fileSizeBytes && ` • ${formatFileSize(material.fileSizeBytes)}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {material.sharedWithTherapist ? (
                    <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                      <Check className="w-4 h-4" />
                      Geteilt
                    </span>
                  ) : (
                    <button
                      onClick={() => handleShareWithTherapist(material.id)}
                      className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm hover:bg-blue-200"
                    >
                      <Share2 className="w-4 h-4" />
                      Teilen
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleDownloadMaterial(material.id)}
                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Upload className="w-4 h-4 rotate-180" />
                  </button>
                  
                  <button
                    onClick={() => handleDeleteMaterial(material.id)}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Note Modal */}
      {showNoteModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="patient-materials-note-title"
          onMouseDown={(e) => {
            // Klick auf Backdrop schließt (einfach & erwartbar)
            if (e.target === e.currentTarget) {
              setShowNoteModal(false);
              setNoteContent('');
            }
          }}
        >
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h2 id="patient-materials-note-title" className="text-xl font-bold mb-4">Neue Notiz erstellen</h2>
            
            <textarea
              ref={noteTextareaRef}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Schreiben Sie hier Ihre Notizen zur Vorbereitung auf die Sitzung..."
              className="w-full h-64 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowNoteModal(false);
                  setNoteContent('');
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Abbrechen
              </button>
              <button
                onClick={handleUploadNote}
                disabled={uploading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
