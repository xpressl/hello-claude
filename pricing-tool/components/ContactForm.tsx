"use client"

import { ValidationErrors } from "@/lib/types"

interface ContactFormProps {
  name: string
  email: string
  phone: string
  onChange: (field: 'customer_name' | 'customer_email' | 'customer_phone', value: string) => void
  errors: ValidationErrors
  onBlur: (field: 'customer_name' | 'customer_email') => void
}

export default function ContactForm({ name, email, phone, onChange, errors, onBlur }: ContactFormProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <h2 className="text-lg font-semibold mb-4">Contact Information</h2>

      <div className="space-y-4">
        {/* Name Field */}
        <div>
          <label htmlFor="customer_name" className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            id="customer_name"
            type="text"
            value={name}
            onChange={(e) => onChange('customer_name', e.target.value)}
            onBlur={() => onBlur('customer_name')}
            className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.customer_name ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter your name"
            aria-required="true"
            aria-invalid={!!errors.customer_name}
            aria-describedby={errors.customer_name ? 'customer_name-error' : undefined}
          />
          {errors.customer_name && (
            <p id="customer_name-error" className="mt-1 text-sm text-red-600">
              {errors.customer_name}
            </p>
          )}
        </div>

        {/* Email Field */}
        <div>
          <label htmlFor="customer_email" className="block text-sm font-medium text-gray-700 mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            id="customer_email"
            type="email"
            value={email}
            onChange={(e) => onChange('customer_email', e.target.value)}
            onBlur={() => onBlur('customer_email')}
            className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.customer_email ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="your.email@example.com"
            aria-required="true"
            aria-invalid={!!errors.customer_email}
            aria-describedby={errors.customer_email ? 'customer_email-error' : undefined}
          />
          {errors.customer_email && (
            <p id="customer_email-error" className="mt-1 text-sm text-red-600">
              {errors.customer_email}
            </p>
          )}
        </div>

        {/* Phone Field */}
        <div>
          <label htmlFor="customer_phone" className="block text-sm font-medium text-gray-700 mb-1">
            Phone <span className="text-gray-400 text-xs">(optional)</span>
          </label>
          <input
            id="customer_phone"
            type="tel"
            value={phone}
            onChange={(e) => onChange('customer_phone', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="(555) 123-4567"
          />
        </div>
      </div>
    </div>
  )
}
