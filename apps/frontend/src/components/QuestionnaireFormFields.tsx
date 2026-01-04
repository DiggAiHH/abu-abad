import { useMemo } from 'react';

export type FormResponses = Record<string, any>;

export function normalizeFormSchema(input: any): any {
  if (!input || typeof input !== 'object') {
    return { type: 'object', properties: {}, required: [] };
  }

  // Already JSON-Schema-like
  if (input.properties && typeof input.properties === 'object') {
    return input;
  }

  // Backend format: { fields: [...] }
  const fields = Array.isArray((input as any).fields) ? (input as any).fields : [];
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const field of fields) {
    if (!field?.id || !field?.type) continue;

    const fieldSchema: any = {};

    switch (field.type) {
      case 'textarea':
        fieldSchema.type = 'string';
        fieldSchema.format = 'textarea';
        break;
      case 'email':
        fieldSchema.type = 'string';
        fieldSchema.format = 'email';
        break;
      case 'tel':
        fieldSchema.type = 'string';
        fieldSchema.format = 'tel';
        break;
      case 'date':
        fieldSchema.type = 'string';
        fieldSchema.format = 'date';
        break;
      case 'number':
        fieldSchema.type = 'number';
        break;
      case 'select':
      case 'radio':
        fieldSchema.type = 'string';
        if (Array.isArray(field.options)) fieldSchema.enum = field.options;
        break;
      case 'checkbox':
        fieldSchema.type = 'array';
        fieldSchema.items = {
          type: 'string',
          enum: Array.isArray(field.options) ? field.options : [],
        };
        break;
      default:
        fieldSchema.type = 'string';
        break;
    }

    fieldSchema.title = field.label;
    fieldSchema.description = field.placeholder;
    properties[field.id] = fieldSchema;
    if (field.required) required.push(field.id);
  }

  return { type: 'object', properties, required };
}

function coerceNumber(value: string): number | '' {
  if (!value) return '';
  const n = Number(value);
  return Number.isFinite(n) ? n : '';
}

export function QuestionnaireFormFields(props: {
  formSchema: any;
  responses: FormResponses;
  onResponsesChange: (next: FormResponses) => void;
  readOnly?: boolean;
}): JSX.Element {
  const { formSchema, responses, onResponsesChange, readOnly = false } = props;
  const normalized = useMemo(() => normalizeFormSchema(formSchema), [formSchema]);

  const requiredFields: string[] = Array.isArray(normalized.required) ? normalized.required : [];

  const renderField = (fieldId: string, fieldSchema: any) => {
    const value = responses[fieldId];

    const handleChange = (newValue: any) => {
      if (readOnly) return;
      onResponsesChange({ ...responses, [fieldId]: newValue });
    };

    const commonClasses =
      'w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500';

    switch (fieldSchema.type) {
      case 'string':
        if (fieldSchema.enum) {
          return (
            <div className="space-y-2">
              {fieldSchema.enum.map((option: string) => (
                <label key={option} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={fieldId}
                    value={option}
                    checked={value === option}
                    onChange={(e) => handleChange(e.target.value)}
                    className="rounded"
                    disabled={readOnly}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          );
        }

        if (fieldSchema.format === 'textarea') {
          return (
            <textarea
              value={value || ''}
              onChange={(e) => handleChange(e.target.value)}
              className={commonClasses}
              rows={4}
              placeholder={fieldSchema.description}
              readOnly={readOnly}
            />
          );
        }

        return (
          <input
            type={fieldSchema.format || 'text'}
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            className={commonClasses}
            placeholder={fieldSchema.description}
            readOnly={readOnly}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value ?? ''}
            onChange={(e) => handleChange(coerceNumber(e.target.value))}
            className={commonClasses}
            placeholder={fieldSchema.description}
            readOnly={readOnly}
          />
        );

      case 'array':
        if (fieldSchema.items?.enum) {
          const selected = Array.isArray(value) ? value : [];
          return (
            <div className="space-y-2">
              {fieldSchema.items.enum.map((option: string) => (
                <label key={option} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(option)}
                    onChange={(e) => {
                      if (readOnly) return;
                      if (e.target.checked) {
                        handleChange([...selected, option]);
                      } else {
                        handleChange(selected.filter((x: string) => x !== option));
                      }
                    }}
                    className="rounded"
                    disabled={readOnly}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          );
        }

        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            className={commonClasses}
            readOnly={readOnly}
          />
        );

      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            className={commonClasses}
            readOnly={readOnly}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      {Object.entries(normalized.properties || {}).map(
        ([fieldId, fieldSchema]: [string, any]) => {
          const isRequired = requiredFields.includes(fieldId);

          return (
            <div
              key={fieldId}
              className="border-b border-gray-200 pb-6 last:border-0"
            >
              <label className="block mb-2">
                <span className="text-gray-900 font-medium">
                  {fieldSchema.title}
                  {isRequired && <span className="text-red-600 ml-1">*</span>}
                </span>
              </label>

              {renderField(fieldId, fieldSchema)}
            </div>
          );
        }
      )}
    </div>
  );
}
