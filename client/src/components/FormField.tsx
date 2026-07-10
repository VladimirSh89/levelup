interface FormFieldProps {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
}

export default function FormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  required,
  placeholder,
  autoComplete,
}: FormFieldProps) {
  return (
    <label className="block" htmlFor={name}>
      <span className="mb-2 block font-label text-label-caps uppercase text-on-surface-variant">{label}</span>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-outline-variant bg-surface-container-low px-4 py-3 font-body text-body-md text-on-surface outline-none transition-colors focus:border-primary"
      />
    </label>
  );
}
