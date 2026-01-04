/**
 * Questionnaire Response Component (Patient)
 * Ermöglicht Patienten, vom Therapeuten angeforderte Fragebögen zu beantworten
 * Auto-Save Drafts, Progress Tracking, DSGVO-konforme Verschlüsselung
 */

import { useState, useEffect } from 'react';
import { Check, Clock, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../api/client';
import { logger } from '../utils/logger';
import { QuestionnaireFormFields, normalizeFormSchema } from '../components/QuestionnaireFormFields';

interface QuestionnaireRequest {
  id: string;
  templateTitle: string;
  templateDescription?: string;
  formSchema: any;
  dueDate?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed';
  progress?: number;
  createdAt: string;
}

type FormResponses = Record<string, any>;

export default function PatientQuestionnaires() {
  const [requests, setRequests] = useState<QuestionnaireRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Active Questionnaire
  const [activeRequest, setActiveRequest] = useState<QuestionnaireRequest | null>(null);
  const [responses, setResponses] = useState<FormResponses>({});
  const [saving, setSaving] = useState(false);
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    // Auto-save nach 3 Sekunden Inaktivität
    if (activeRequest && autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }

    if (activeRequest && Object.keys(responses).length > 0) {
      const timer = setTimeout(() => {
        handleSaveDraft();
      }, 3000);
      setAutoSaveTimer(timer);
    }

    return () => {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
    };
  }, [responses]);

  const loadRequests = async () => {
    try {
      const response = await apiClient.get('/questionnaires/requests');
      const mapped: QuestionnaireRequest[] = (response.data.requests || []).map((r: any) => ({
        id: r.id,
        templateTitle: r.templateTitle,
        templateDescription: r.instructions || undefined,
        formSchema: normalizeFormSchema(r.formSchema),
        dueDate: r.deadline || undefined,
        priority: r.priority,
        status: r.status,
        progress: undefined,
        createdAt: r.createdAt
      }));

      setRequests(mapped);
    } catch (error: any) {
      logger.error('PatientQuestionnaires: Error loading requests', error);
      toast.error('Fehler beim Laden der Fragebögen');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingResponse = async (requestId: string) => {
    try {
      const response = await apiClient.get(`/questionnaires/responses/${requestId}`);
      if (response.data?.responses) {
        setResponses(response.data.responses || {});
      }
    } catch (error: any) {
      // Noch keine Antwort vorhanden
      logger.debug('PatientQuestionnaires: No existing response');
    }
  };

  const handleStartQuestionnaire = async (request: QuestionnaireRequest) => {
    setActiveRequest(request);
    await loadExistingResponse(request.id);
  };

  const handleSaveDraft = async () => {
    if (!activeRequest) return;

    setSaving(true);
    try {
      await apiClient.post('/questionnaires/responses', {
        requestId: activeRequest.id,
        responses,
        status: 'draft'
      });
      
      // Update progress in UI
      const progress = calculateProgress();
      const updatedRequests = requests.map(r => 
        r.id === activeRequest.id 
          ? { ...r, status: 'in_progress' as const, progress }
          : r
      );
      setRequests(updatedRequests);
    } catch (error: any) {
      logger.error('PatientQuestionnaires: Error saving draft', error);
      // Silent fail für Auto-Save
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!activeRequest) return;

    // Validate required fields
    const requiredFields = activeRequest.formSchema.required || [];
    const missingFields = requiredFields.filter((field: string) => {
      const value = responses[field];
      if (value === undefined || value === null || value === '') return true;
      if (Array.isArray(value) && value.length === 0) return true;
      return false;
    });
    
    if (missingFields.length > 0) {
      toast.error('Bitte füllen Sie alle Pflichtfelder aus');
      return;
    }

    setSaving(true);
    try {
      await apiClient.post('/questionnaires/responses', {
        requestId: activeRequest.id,
        responses,
        status: 'submitted'
      });

      toast.success('Fragebogen eingereicht');
      setActiveRequest(null);
      setResponses({});
      await loadRequests();
    } catch (error: any) {
      logger.error('PatientQuestionnaires: Error submitting questionnaire', error);
      toast.error('Fehler beim Einreichen');
    } finally {
      setSaving(false);
    }
  };

  const calculateProgress = (): number => {
    if (!activeRequest) return 0;
    
    const totalFields = Object.keys(activeRequest.formSchema.properties || {}).length;
    if (totalFields === 0) return 0;
    
    const answeredFields = Object.keys(responses).filter(key => {
      const value = responses[key];
      return value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0);
    }).length;
    
    return Math.round((answeredFields / totalFields) * 100);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-red-100 text-red-800';
      case 'normal': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-green-100 text-green-800';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'Dringend';
      case 'high': return 'Dringend';
      case 'normal': return 'Normal';
      default: return 'Niedrig';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Questionnaire View
  if (activeRequest) {
    const progress = calculateProgress();
    
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => {
                if (confirm('Möchten Sie wirklich abbrechen? Ihr Fortschritt wurde gespeichert.')) {
                  setActiveRequest(null);
                  setResponses({});
                }
              }}
              className="text-blue-600 hover:text-blue-800 mb-4"
            >
              ← Zurück zur Übersicht
            </button>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {activeRequest.templateTitle}
            </h1>
            {activeRequest.templateDescription && (
              <p className="text-gray-600 mb-4">{activeRequest.templateDescription}</p>
            )}

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Fortschritt</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Auto-save Indicator */}
            {saving && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Save className="w-4 h-4 animate-pulse" />
                Wird gespeichert...
              </div>
            )}
          </div>

          {/* Form Fields */}
          <QuestionnaireFormFields
            formSchema={activeRequest.formSchema}
            responses={responses}
            onResponsesChange={setResponses}
          />

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-2">
            <button
              onClick={handleSaveDraft}
              disabled={saving}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:opacity-50"
            >
              Entwurf speichern
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || progress < 100}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Einreichen
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Requests List
  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Meine Fragebögen
        </h1>

        {requests.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Clock className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p>Keine offenen Fragebögen</p>
            <p className="text-sm">Ihr Therapeut hat noch keine Fragebögen angefordert</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {requests.map((request) => (
              <div
                key={request.id}
                className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {request.templateTitle}
                      </h3>
                      <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(request.priority)}`}>
                        {getPriorityLabel(request.priority)}
                      </span>
                    </div>
                    
                    {request.templateDescription && (
                      <p className="text-sm text-gray-600 mb-2">{request.templateDescription}</p>
                    )}

                    {request.dueDate && (
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Fällig: {new Date(request.dueDate).toLocaleDateString('de-DE')}
                      </p>
                    )}

                    {request.status === 'in_progress' && (
                      <div className="mt-2">
                        <div className="w-32 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600"
                            style={{ width: `${request.progress || 0}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {request.progress || 0}% abgeschlossen
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    {request.status === 'completed' ? (
                      <span className="flex items-center gap-1 px-3 py-2 bg-green-100 text-green-800 rounded-lg text-sm">
                        <Check className="w-4 h-4" />
                        Abgeschlossen
                      </span>
                    ) : (
                      <button
                        onClick={() => handleStartQuestionnaire(request)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        {request.status === 'in_progress' ? 'Fortsetzen' : 'Beginnen'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
