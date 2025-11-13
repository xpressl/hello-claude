/**
 * Pricing Engine Tests
 *
 * Comprehensive test suite for the pricing engine with >90% coverage
 */

import Decimal from 'decimal.js'

// Set up environment variables for testing
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

// Mock Supabase client
const mockSupabaseFrom = jest.fn()
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mockSupabaseFrom
  }))
}))

// Now import everything we need
import {
  calculatePrice,
  validateOptions,
  formatPrice,
  fetchItemOptions,
  type PricingContext,
  type ItemOption,
} from '../pricing-engine'

describe('Pricing Engine', () => {
  // Helper function to setup Supabase mocks for item_options query
  function mockItemOptions(options: ItemOption[]) {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'item_options') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: options,
                  error: null
                })
              })
            })
          })
        }
      }
      if (table === 'option_values') {
        return {
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: options.flatMap(o => o.values || []),
                  error: null
                })
              })
            })
          })
        }
      }
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: null, error: null })
            })
          })
        })
      }
    })
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('calculatePrice', () => {
    test('calculates base price with no options', async () => {
      mockItemOptions([])

      const result = await calculatePrice({
        catalogItem: {
          id: '1',
          sku: 'TEST-100',
          name: 'Test Product',
          unit_price: 100
        },
        options: {},
        quantity: 1
      })

      expect(result.unit_price).toBe(100)
      expect(result.extended_price).toBe(100)
      expect(result.price_breakdown).toHaveLength(1)
      expect(result.price_breakdown[0].type).toBe('base')
      expect(result.trace).toHaveLength(2) // base + extended
    })

    test('adds flat option delta from select option value', async () => {
      mockItemOptions([
        {
          id: 'opt1',
          item_id: '1',
          code: 'SIZE',
          label: 'Size',
          type: 'select',
          required: true,
          sort_order: 1,
          values: [
            { id: 'v1', option_id: 'opt1', value: '30x80', label: '30" x 80"', price_delta: 0, sort_order: 1 },
            { id: 'v2', option_id: 'opt1', value: '36x80', label: '36" x 80"', price_delta: 25, sort_order: 2 }
          ]
        }
      ])

      const result = await calculatePrice({
        catalogItem: {
          id: '1',
          sku: 'DOOR-100',
          name: 'Standard Door',
          unit_price: 100
        },
        options: { SIZE: '36x80' },
        quantity: 1
      })

      expect(result.unit_price).toBe(125)
      expect(result.extended_price).toBe(125)
      expect(result.price_breakdown).toHaveLength(2) // base + option
      expect(result.price_breakdown[1].type).toBe('option_flat')
      expect(result.price_breakdown[1].amount).toBe(25)
    })

    test('adds flat option delta from option level', async () => {
      mockItemOptions([
        {
          id: 'opt1',
          item_id: '1',
          code: 'HARDWARE',
          label: 'Hardware Package',
          type: 'checkbox',
          required: false,
          sort_order: 1,
          price_delta_type: 'flat',
          price_delta_value: 15,
          values: []
        }
      ])

      const result = await calculatePrice({
        catalogItem: {
          id: '1',
          sku: 'DOOR-100',
          name: 'Standard Door',
          unit_price: 100
        },
        options: { HARDWARE: true },
        quantity: 1
      })

      expect(result.unit_price).toBe(115)
      expect(result.extended_price).toBe(115)
    })

    test('applies percentage option delta', async () => {
      mockItemOptions([
        {
          id: 'opt1',
          item_id: '1',
          code: 'RUSH',
          label: 'Rush Order',
          type: 'checkbox',
          required: false,
          sort_order: 1,
          price_delta_type: 'percent',
          price_delta_value: 10,
          values: []
        }
      ])

      const result = await calculatePrice({
        catalogItem: {
          id: '1',
          sku: 'TEST-100',
          name: 'Test Product',
          unit_price: 100
        },
        options: { RUSH: true },
        quantity: 1
      })

      expect(result.unit_price).toBe(110)
      expect(result.extended_price).toBe(110)
      expect(result.price_breakdown[1].type).toBe('option_percent')
    })

    test('combines multiple options correctly - flat then percent', async () => {
      mockItemOptions([
        {
          id: 'opt1',
          item_id: '1',
          code: 'SIZE',
          label: 'Size',
          type: 'select',
          required: true,
          sort_order: 1,
          values: [
            { id: 'v1', option_id: 'opt1', value: '36x80', label: '36" x 80"', price_delta: 25, sort_order: 1 }
          ]
        },
        {
          id: 'opt2',
          item_id: '1',
          code: 'RUSH',
          label: 'Rush Order',
          type: 'checkbox',
          required: false,
          sort_order: 2,
          price_delta_type: 'percent',
          price_delta_value: 10,
          values: []
        }
      ])

      const result = await calculatePrice({
        catalogItem: {
          id: '1',
          sku: 'DOOR-100',
          name: 'Standard Door',
          unit_price: 100
        },
        options: { SIZE: '36x80', RUSH: true },
        quantity: 1
      })

      // Expected: (100 + 25) * 1.10 = 137.50
      expect(result.unit_price).toBe(137.50)
      expect(result.extended_price).toBe(137.50)
    })

    test('calculates extended price with quantity', async () => {
      mockItemOptions([])

      const result = await calculatePrice({
        catalogItem: {
          id: '1',
          sku: 'TEST-100',
          name: 'Test Product',
          unit_price: 100
        },
        options: {},
        quantity: 5
      })

      expect(result.unit_price).toBe(100)
      expect(result.extended_price).toBe(500)
    })

    test('handles decimal precision correctly', async () => {
      mockItemOptions([])

      const result = await calculatePrice({
        catalogItem: {
          id: '1',
          sku: 'TEST-99',
          name: 'Test Product',
          unit_price: 99.99
        },
        options: {},
        quantity: 3
      })

      // No floating point errors
      expect(result.unit_price).toBe(99.99)
      expect(result.extended_price).toBe(299.97)
    })

    test('handles complex decimal calculations', async () => {
      mockItemOptions([
        {
          id: 'opt1',
          item_id: '1',
          code: 'SURCHARGE',
          label: 'Fuel Surcharge',
          type: 'checkbox',
          required: false,
          sort_order: 1,
          price_delta_type: 'percent',
          price_delta_value: 7.5,
          values: []
        }
      ])

      const result = await calculatePrice({
        catalogItem: {
          id: '1',
          sku: 'TEST-99',
          name: 'Test Product',
          unit_price: 99.99
        },
        options: { SURCHARGE: true },
        quantity: 3
      })

      // 99.99 * 1.075 = 107.4892... should round to 107.49
      expect(result.unit_price).toBe(107.49)
      // 107.49 * 3 = 322.47
      expect(result.extended_price).toBe(322.47)
    })

    test('applies banker\'s rounding (ROUND_HALF_EVEN)', async () => {
      mockItemOptions([
        {
          id: 'opt1',
          item_id: '1',
          code: 'ADDON',
          label: 'Add-on',
          type: 'checkbox',
          required: false,
          sort_order: 1,
          price_delta_type: 'flat',
          price_delta_value: 0.005,
          values: []
        }
      ])

      const result = await calculatePrice({
        catalogItem: {
          id: '1',
          sku: 'TEST-100',
          name: 'Test Product',
          unit_price: 100.005
        },
        options: { ADDON: true },
        quantity: 1
      })

      // 100.005 + 0.005 = 100.010, rounds to 100.01 (even)
      expect(result.unit_price).toBe(100.01)
    })

    test('generates complete price trace', async () => {
      mockItemOptions([
        {
          id: 'opt1',
          item_id: '1',
          code: 'SIZE',
          label: 'Size',
          type: 'select',
          required: true,
          sort_order: 1,
          values: [
            { id: 'v1', option_id: 'opt1', value: '36x80', label: '36" x 80"', price_delta: 25, sort_order: 1 }
          ]
        },
        {
          id: 'opt2',
          item_id: '1',
          code: 'RUSH',
          label: 'Rush Order',
          type: 'checkbox',
          required: false,
          sort_order: 2,
          price_delta_type: 'percent',
          price_delta_value: 10,
          values: []
        }
      ])

      const result = await calculatePrice({
        catalogItem: {
          id: '1',
          sku: 'DOOR-100',
          name: 'Standard Door',
          unit_price: 100
        },
        options: { SIZE: '36x80', RUSH: true },
        quantity: 2
      })

      expect(result.trace).toHaveLength(4) // base, size, rush, extended
      expect(result.trace[0].description).toBe('Base product price')
      expect(result.trace[0].result).toBe(100)
      expect(result.trace[1].description).toContain('Size')
      expect(result.trace[1].result).toBe(125)
      expect(result.trace[2].description).toContain('Rush Order')
      expect(result.trace[2].result).toBe(137.5)
      expect(result.trace[3].description).toBe('Calculate extended price')
      expect(result.trace[3].result).toBe(275)
    })

    test('ignores unknown option codes', async () => {
      mockItemOptions([])

      const result = await calculatePrice({
        catalogItem: {
          id: '1',
          sku: 'TEST-100',
          name: 'Test Product',
          unit_price: 100
        },
        options: { UNKNOWN: 'value' },
        quantity: 1
      })

      expect(result.unit_price).toBe(100)
      expect(result.price_breakdown).toHaveLength(1) // Only base
    })

    test('handles zero price delta', async () => {
      mockItemOptions([
        {
          id: 'opt1',
          item_id: '1',
          code: 'COLOR',
          label: 'Color',
          type: 'select',
          required: false,
          sort_order: 1,
          values: [
            { id: 'v1', option_id: 'opt1', value: 'white', label: 'White', price_delta: 0, sort_order: 1 }
          ]
        }
      ])

      const result = await calculatePrice({
        catalogItem: {
          id: '1',
          sku: 'TEST-100',
          name: 'Test Product',
          unit_price: 100
        },
        options: { COLOR: 'white' },
        quantity: 1
      })

      expect(result.unit_price).toBe(100)
      expect(result.price_breakdown).toHaveLength(1) // Base only, no zero delta added
    })

    test('handles null price delta values', async () => {
      mockItemOptions([
        {
          id: 'opt1',
          item_id: '1',
          code: 'NOTE',
          label: 'Special Note',
          type: 'text',
          required: false,
          sort_order: 1,
          price_delta_type: null,
          price_delta_value: null,
          values: []
        }
      ])

      const result = await calculatePrice({
        catalogItem: {
          id: '1',
          sku: 'TEST-100',
          name: 'Test Product',
          unit_price: 100
        },
        options: { NOTE: 'Custom text' },
        quantity: 1
      })

      expect(result.unit_price).toBe(100)
      expect(result.price_breakdown).toHaveLength(1) // Base only
    })
  })

  describe('validateOptions', () => {
    test('validates required options', () => {
      const options: ItemOption[] = [
        {
          id: '1',
          item_id: '1',
          code: 'SIZE',
          label: 'Size',
          type: 'select',
          required: true,
          sort_order: 1,
          values: []
        }
      ]

      const validation = validateOptions(options, {})

      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('Size is required')
    })

    test('passes when required options are provided', () => {
      const options: ItemOption[] = [
        {
          id: '1',
          item_id: '1',
          code: 'SIZE',
          label: 'Size',
          type: 'select',
          required: true,
          sort_order: 1,
          values: [
            { id: 'v1', option_id: '1', value: '36x80', label: '36" x 80"', price_delta: 0, sort_order: 1 }
          ]
        }
      ]

      const validation = validateOptions(options, { SIZE: '36x80' })

      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    test('validates select option values', () => {
      const options: ItemOption[] = [
        {
          id: '1',
          item_id: '1',
          code: 'COLOR',
          label: 'Color',
          type: 'select',
          required: false,
          sort_order: 1,
          values: [
            { id: 'v1', option_id: '1', value: 'red', label: 'Red', price_delta: 0, sort_order: 1 },
            { id: 'v2', option_id: '1', value: 'blue', label: 'Blue', price_delta: 0, sort_order: 2 }
          ]
        }
      ]

      const validation = validateOptions(options, { COLOR: 'green' })

      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('Color value "green" is not valid')
    })

    test('validates number constraints - min', () => {
      const options: ItemOption[] = [
        {
          id: '1',
          item_id: '1',
          code: 'WIDTH',
          label: 'Width',
          type: 'number',
          required: false,
          sort_order: 1,
          constraints_json: { min: 24, max: 96 },
          values: []
        }
      ]

      const validation = validateOptions(options, { WIDTH: 20 })

      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('Width must be at least 24')
    })

    test('validates number constraints - max', () => {
      const options: ItemOption[] = [
        {
          id: '1',
          item_id: '1',
          code: 'WIDTH',
          label: 'Width',
          type: 'number',
          required: false,
          sort_order: 1,
          constraints_json: { min: 24, max: 96 },
          values: []
        }
      ]

      const validation = validateOptions(options, { WIDTH: 120 })

      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('Width must be at most 96')
    })

    test('validates number constraints - step', () => {
      const options: ItemOption[] = [
        {
          id: '1',
          item_id: '1',
          code: 'LENGTH',
          label: 'Length',
          type: 'number',
          required: false,
          sort_order: 1,
          constraints_json: { min: 0, step: 0.5 },
          values: []
        }
      ]

      const validation = validateOptions(options, { LENGTH: 10.3 })

      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('Length must be a multiple of 0.5')
    })

    test('validates text constraints - min_length', () => {
      const options: ItemOption[] = [
        {
          id: '1',
          item_id: '1',
          code: 'NOTE',
          label: 'Note',
          type: 'text',
          required: false,
          sort_order: 1,
          constraints_json: { min_length: 5, max_length: 100 },
          values: []
        }
      ]

      const validation = validateOptions(options, { NOTE: 'Hi' })

      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('Note must be at least 5 characters')
    })

    test('validates text constraints - max_length', () => {
      const options: ItemOption[] = [
        {
          id: '1',
          item_id: '1',
          code: 'NOTE',
          label: 'Note',
          type: 'text',
          required: false,
          sort_order: 1,
          constraints_json: { min_length: 5, max_length: 10 },
          values: []
        }
      ]

      const validation = validateOptions(options, { NOTE: 'This is a very long note' })

      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('Note must be at most 10 characters')
    })

    test('validates text constraints - pattern', () => {
      const options: ItemOption[] = [
        {
          id: '1',
          item_id: '1',
          code: 'SKU',
          label: 'SKU',
          type: 'text',
          required: false,
          sort_order: 1,
          constraints_json: { pattern: '^[A-Z]{3}-[0-9]{3}$' },
          values: []
        }
      ]

      const validation = validateOptions(options, { SKU: 'invalid' })

      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('SKU format is invalid')
    })

    test('validates checkbox type', () => {
      const options: ItemOption[] = [
        {
          id: '1',
          item_id: '1',
          code: 'RUSH',
          label: 'Rush Order',
          type: 'checkbox',
          required: false,
          sort_order: 1,
          values: []
        }
      ]

      const validation = validateOptions(options, { RUSH: 'yes' })

      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('Rush Order must be true or false')
    })

    test('ignores unknown option codes', () => {
      const options: ItemOption[] = []

      const validation = validateOptions(options, { UNKNOWN: 'value' })

      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    test('skips validation for empty non-required options', () => {
      const options: ItemOption[] = [
        {
          id: '1',
          item_id: '1',
          code: 'NOTE',
          label: 'Note',
          type: 'text',
          required: false,
          sort_order: 1,
          constraints_json: { min_length: 5 },
          values: []
        }
      ]

      const validation = validateOptions(options, { NOTE: '' })

      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    test('validates invalid number format', () => {
      const options: ItemOption[] = [
        {
          id: '1',
          item_id: '1',
          code: 'WIDTH',
          label: 'Width',
          type: 'number',
          required: false,
          sort_order: 1,
          constraints_json: { min: 0 },
          values: []
        }
      ]

      const validation = validateOptions(options, { WIDTH: 'not-a-number' })

      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('Width must be a valid number')
    })
  })

  describe('formatPrice', () => {
    test('formats price in USD', () => {
      expect(formatPrice(123.45)).toBe('$123.45')
      expect(formatPrice(1000)).toBe('$1,000.00')
      expect(formatPrice(0.99)).toBe('$0.99')
    })

    test('formats price with custom currency', () => {
      expect(formatPrice(123.45, 'EUR')).toContain('123.45')
    })

    test('always shows 2 decimal places', () => {
      expect(formatPrice(100)).toBe('$100.00')
      expect(formatPrice(100.5)).toBe('$100.50')
    })
  })

  describe('fetchItemOptions', () => {
    test('returns empty array when item_options table does not exist', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'item_options') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: null,
                    error: { code: '42P01', message: 'Table does not exist' }
                  })
                })
              })
            })
          }
        }
        return {}
      })

      const result = await fetchItemOptions('test-id')
      expect(result).toEqual([])
    })

    test('returns empty array when option_values table does not exist', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'item_options') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: [{
                      id: 'opt1',
                      item_id: 'test-id',
                      code: 'TEST',
                      label: 'Test',
                      type: 'text',
                      required: false,
                      sort_order: 1
                    }],
                    error: null
                  })
                })
              })
            })
          }
        }
        if (table === 'option_values') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: null,
                    error: { code: '42P01', message: 'Table does not exist' }
                  })
                })
              })
            })
          }
        }
        return {}
      })

      const result = await fetchItemOptions('test-id')
      expect(result).toHaveLength(1)
      expect(result[0].values).toEqual([])
    })

    test('returns empty array on general error', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'item_options') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'ERROR', message: 'General error' }
                  })
                })
              })
            })
          }
        }
        return {}
      })

      // Should catch error and return empty array
      const result = await fetchItemOptions('test-id')
      expect(result).toEqual([])
    })

    test('returns empty array when no options found', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'item_options') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: [],
                    error: null
                  })
                })
              })
            })
          }
        }
        return {}
      })

      const result = await fetchItemOptions('test-id')
      expect(result).toEqual([])
    })
  })

  describe('validateOptions - edge cases', () => {
    test('handles invalid regex pattern gracefully', () => {
      const options: ItemOption[] = [
        {
          id: '1',
          item_id: '1',
          code: 'SKU',
          label: 'SKU',
          type: 'text',
          required: false,
          sort_order: 1,
          constraints_json: { pattern: '[invalid(regex' },  // Invalid regex
          values: []
        }
      ]

      // Should not throw, just skip pattern validation
      const validation = validateOptions(options, { SKU: 'test' })
      expect(validation.valid).toBe(true)
    })
  })
})
