import { parseCSV, detectCSVColumns } from '../csv-parser'

describe('CSV Parser', () => {
  describe('parseCSV', () => {
    it('should parse simple CSV with headers', async () => {
      const csvContent = 'SKU,Description,Quantity\nDR-123,Steel Door,5\nWD-456,Window,3'
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' })

      const result = await parseCSV(file)

      expect(result.headers).toEqual(['sku', 'description', 'quantity'])
      expect(result.rows).toHaveLength(2)
      expect(result.rows[0]).toEqual({
        sku: 'DR-123',
        description: 'Steel Door',
        quantity: 5
      })
      expect(result.errors).toHaveLength(0)
    })

    it('should handle quoted fields with commas', async () => {
      const csvContent = 'SKU,Description\nDR-123,"Door, Steel"\nWD-456,"Window, Double Pane"'
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' })

      const result = await parseCSV(file)

      expect(result.rows[0].description).toBe('Door, Steel')
      expect(result.rows[1].description).toBe('Window, Double Pane')
    })

    it('should normalize headers', async () => {
      const csvContent = 'Product SKU,Item Description,Qty\nDR-123,Steel Door,5'
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' })

      const result = await parseCSV(file)

      expect(result.headers).toEqual(['product_sku', 'item_description', 'qty'])
    })

    it('should auto-convert numbers', async () => {
      const csvContent = 'SKU,Price,Quantity\nDR-123,100.50,5'
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' })

      const result = await parseCSV(file)

      expect(typeof result.rows[0].price).toBe('number')
      expect(result.rows[0].price).toBe(100.50)
      expect(typeof result.rows[0].quantity).toBe('number')
      expect(result.rows[0].quantity).toBe(5)
    })

    it('should skip empty lines', async () => {
      const csvContent = 'SKU,Description\nDR-123,Door\n\nWD-456,Window\n\n'
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' })

      const result = await parseCSV(file)

      expect(result.rows).toHaveLength(2)
    })
  })

  describe('detectCSVColumns', () => {
    it('should detect SKU column', () => {
      const headers = ['product_sku', 'description', 'qty']
      const mapping = detectCSVColumns(headers)

      expect(mapping.sku).toBe('product_sku')
    })

    it('should detect quantity column', () => {
      const headers = ['sku', 'description', 'quantity']
      const mapping = detectCSVColumns(headers)

      expect(mapping.quantity).toBe('quantity')
    })

    it('should detect description column', () => {
      const headers = ['sku', 'product_name', 'qty']
      const mapping = detectCSVColumns(headers)

      expect(mapping.description).toBe('product_name')
    })

    it('should detect size column', () => {
      const headers = ['sku', 'description', 'size', 'qty']
      const mapping = detectCSVColumns(headers)

      expect(mapping.size).toBe('size')
    })

    it('should detect unit column', () => {
      const headers = ['sku', 'description', 'qty', 'unit']
      const mapping = detectCSVColumns(headers)

      expect(mapping.unit).toBe('unit')
    })

    it('should detect price column', () => {
      const headers = ['sku', 'description', 'unit_price', 'qty']
      const mapping = detectCSVColumns(headers)

      expect(mapping.price).toBe('unit_price')
    })

    it('should handle missing columns gracefully', () => {
      const headers = ['column1', 'column2']
      const mapping = detectCSVColumns(headers)

      expect(mapping.sku).toBeUndefined()
      expect(mapping.quantity).toBeUndefined()
      expect(mapping.description).toBeUndefined()
    })

    it('should detect all common column types', () => {
      const headers = ['item_code', 'product_description', 'qty', 'dimension', 'uom', 'unit_price']
      const mapping = detectCSVColumns(headers)

      expect(mapping.sku).toBe('item_code')
      expect(mapping.description).toBe('product_description')
      expect(mapping.quantity).toBe('qty')
      expect(mapping.size).toBe('dimension')
      expect(mapping.unit).toBe('uom')
      expect(mapping.price).toBe('unit_price')
    })
  })
})
