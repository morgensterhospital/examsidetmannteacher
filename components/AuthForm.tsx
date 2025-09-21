
import React, { useState } from 'react';

// This file is a placeholder for future shared form components, but the logic is kept in AuthPage.tsx for simplicity to meet the "handful of files" constraint.
// The primary authentication UI and logic is located in `pages/AuthPage.tsx`.
// This component is not actively used but represents how the project could be structured for scalability.

interface FormFieldProps {
  label: string;
  type: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  name: string;
  options?: string[];
  required?: boolean;
}

const FormField: React.FC<FormFieldProps> = ({ label, type, value, onChange, name, options, required = true }) => {
  return (
    <div className="mb-4">
      <label htmlFor={name} className="block text-sm font-medium text-[#cbb6e4] mb-1">{label}</label>
      {type === 'select' ? (
        <select
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          className="w-full px-4 py-2 bg-[#1c1d1f] border border-[#3e4143] rounded-md focus:ring-2 focus:ring-[#a435f0] focus:border-transparent transition"
        >
          {options?.map(opt => <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>)}
        </select>
      ) : (
        <input
          type={type}
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          className="w-full px-4 py-2 bg-[#1c1d1f] border border-[#3e4143] rounded-md focus:ring-2 focus:ring-[#a435f0] focus:border-transparent transition"
        />
      )}
    </div>
  );
};

export default FormField;
